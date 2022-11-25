import {
  binFor,
  LATEST_PLATFORM,
  USE_LATEST_VERSION,
} from '@pockethost/releases'
import {
  CreateInstancePayload,
  CreateInstancePayloadSchema,
  CreateInstanceResult,
  InstanceId,
  InstanceStatus,
  RpcCommands,
  StreamNames,
} from '@pockethost/schema'
import {
  assertTruthy,
  createCleanupManager,
  createTimerManager,
} from '@pockethost/tools'
import { map, reduce } from '@s-libs/micro-dash'
import Bottleneck from 'bottleneck'
import { spawn } from 'child_process'
import getPort from 'get-port'
import { join } from 'path'
import { AsyncReturnType } from 'type-fest'
import {
  DAEMON_PB_DATA_DIR,
  DAEMON_PB_IDLE_TTL,
  DAEMON_PB_PORT_BASE,
  PUBLIC_APP_DOMAIN,
  PUBLIC_APP_PROTOCOL,
} from '../constants'
import { PocketbaseClientApi } from '../db/PbClient'
import { mkInternalAddress, mkInternalUrl } from '../util/internal'
import { dbg, error, logger, warn } from '../util/logger'
import { now } from '../util/now'
import { safeCatch } from '../util/promiseHelper'
import { PocketbaseProcess, spawnInstance } from '../util/spawnInstance'
import { RpcServiceApi } from './RpcService'
import { createWorkerLogger } from './WorkerService/WorkerService'

type InstanceApi = {
  process: PocketbaseProcess
  internalUrl: string
  port: number
  shutdown: () => Promise<void>
  startRequest: () => () => void
}

export type InstanceServiceConfig = {
  client: PocketbaseClientApi
  rpcService: RpcServiceApi
}

export type InstanceServiceApi = AsyncReturnType<typeof createInstanceService>
export const createInstanceService = async (config: InstanceServiceConfig) => {
  const { client, rpcService } = config
  const { registerCommand } = rpcService

  registerCommand<CreateInstancePayload, CreateInstanceResult>(
    RpcCommands.CreateInstance,
    CreateInstancePayloadSchema,
    async (rpc) => {
      const { payload } = rpc
      const { subdomain } = payload
      const instance = await client.createInstance({
        subdomain,
        uid: rpc.userId,
        version: USE_LATEST_VERSION,
        status: InstanceStatus.Idle,
        platform: LATEST_PLATFORM,
        secondsThisMonth: 0,
        isBackupAllowed: false,
        currentWorkerBundleId: '',
        secrets: {},
      })
      return { instance }
    }
  )

  const instances: { [_: string]: InstanceApi } = {}

  const limiter = new Bottleneck({ maxConcurrent: 1 })

  const getInstance = (subdomain: string) =>
    limiter.schedule(async () => {
      // dbg(`Getting instance ${subdomain}`)
      {
        const instance = instances[subdomain]
        if (instance) {
          // dbg(`Found in cache: ${subdomain}`)
          return instance
        }
      }

      dbg(`Checking ${subdomain} for permission`)

      const [instance, owner] = await client.getInstanceBySubdomain(subdomain)
      if (!instance) {
        throw new Error(`${subdomain} not found`)
      }

      if (!owner?.verified) {
        throw new Error(
          `Log in at ${PUBLIC_APP_PROTOCOL}://${PUBLIC_APP_DOMAIN} to verify your account.`
        )
      }

      const shutdownManager = createCleanupManager({ logger })
      try {
        await client.updateInstanceStatus(instance.id, InstanceStatus.Port)
        shutdownManager.add(() =>
          client.updateInstanceStatus(instance.id, InstanceStatus.Idle)
        )

        dbg(`${subdomain} found in DB`)
        const exclude = map(instances, (i) => i.port)
        const newPort = await getPort({
          port: DAEMON_PB_PORT_BASE,
          exclude,
        }).catch((e) => {
          error(`Failed to get port for ${subdomain}`)
          throw e
        })
        dbg(`Found port for ${subdomain}: ${newPort}`)

        await client.updateInstanceStatus(instance.id, InstanceStatus.Starting)

        /**
         * Spawn PocketBase instance
         */
        const pbChildProcess = await spawnInstance({
          subdomain,
          slug: instance.id,
          port: newPort,
          bin: binFor(instance.platform, instance.version),
          onUnexpectedStop: (code) => {
            warn(`${subdomain} exited unexpectedly with ${code}`)
            _api.shutdown()
          },
        })
        const { pid: pbPid } = pbChildProcess
        assertTruthy(pbPid, `Expected PID here but got ${pbPid}`)
        shutdownManager.add(() => {
          const res = pbChildProcess.kill()
          assertTruthy(
            res,
            `Expected child process to exit gracefully but got ${res}`
          )
        })
        if (!instance.isBackupAllowed) {
          await client.updateInstance(instance.id, { isBackupAllowed: true })
        }
        const invocation = await client.createInvocation(instance, pbPid)
        shutdownManager.add(() => client.finalizeInvocation(invocation))

        /**
         * Spawn Deno worker if available
         */
        const cmd = `deno`
        const instanceAddress = mkInternalAddress(newPort)
        //  deno  index.ts
        const args = [
          `run`,
          `--allow-env=POCKETBASE_URL,ADMIN_LOGIN,ADMIN_PASSWORD`,
          `--allow-net=${mkInternalAddress}`,
          join(
            DAEMON_PB_DATA_DIR,
            instance.id,
            `worker`,
            `bundles`,
            `${instance.currentWorkerBundleId}.js`
          ),
        ]

        const denoLogger = await createWorkerLogger(instance.id)
        const denoLogLimiter = new Bottleneck({ maxConcurrent: 1 })
        const denoWrite = (
          message: string,
          stream: StreamNames = StreamNames.Info
        ) =>
          denoLogLimiter.schedule(() => {
            dbg(
              `[${instance.id}:${instance.currentWorkerBundleId}:${stream}] ${message}`
            )
            return denoLogger.write(
              instance.currentWorkerBundleId,
              message,
              stream
            )
          })

        const internalUrl = mkInternalUrl(newPort)
        const env = {
          ...process.env,
          POCKETBASE_URL: internalUrl,
          ADMIN_LOGIN: instance.secrets.ADMIN_LOGIN,
          ADMIN_PASSWORD: instance.secrets.ADMIN_PASSWORD,
        }
        denoWrite(`Worker starting`, StreamNames.System)
        const denoProcess = spawn(cmd, args, { env })
        denoProcess.stderr.on('data', (buf: Buffer) => {
          denoWrite(buf.toString(), StreamNames.Error)
        })
        denoProcess.stdout.on('data', (buf: Buffer) => {
          denoWrite(buf.toString())
        })
        denoProcess.on('exit', async (code, signal) => {
          if (code !== 0) {
            denoWrite(
              `Unexpected 'deno' exit code: ${code}.`,
              StreamNames.Error
            )
          }
          denoWrite(`Worker shutting down`, StreamNames.System)
        })
        shutdownManager.add(() => {
          denoProcess.kill()
        })

        const tm = createTimerManager({})
        shutdownManager.add(tm.shutdown)

        let openRequestCount = 0
        let lastRequest = now()
        const RECHECK_TTL = 1000 // 1 second

        tm.repeat(
          safeCatch(`idleCheck`, async () => {
            dbg(`${subdomain} idle check: ${openRequestCount} open requests`)
            if (
              openRequestCount === 0 &&
              lastRequest + DAEMON_PB_IDLE_TTL < now()
            ) {
              dbg(`${subdomain} idle for ${DAEMON_PB_IDLE_TTL}, shutting down`)
              await _api.shutdown()
              return false
            } else {
              dbg(`${openRequestCount} requests remain open on ${subdomain}`)
            }
            return true
          }),
          RECHECK_TTL
        )

        tm.repeat(
          safeCatch(`uptime`, async () => {
            dbg(`${subdomain} uptime`)
            await client.pingInvocation(invocation)
            return true
          }),
          1000
        )

        const _api: InstanceApi = {
          process: pbChildProcess,
          internalUrl,
          port: newPort,
          shutdown: () => shutdownManager.shutdown(),
          startRequest: () => {
            lastRequest = now()
            openRequestCount++
            const id = openRequestCount
            dbg(`${subdomain} started new request ${id}`)
            return () => {
              openRequestCount--
              dbg(`${subdomain} ended request ${id}`)
            }
          },
        }

        instances[subdomain] = _api
        shutdownManager.add(() => {
          delete instances[subdomain]
        })
        await client.updateInstanceStatus(instance.id, InstanceStatus.Running)
        dbg(`${_api.internalUrl} is running`)
        return instances[subdomain]
      } catch {
        await shutdownManager.shutdown()
      }
    })

  const shutdown = safeCatch(`InstanceManager:shutdown`, async () => {
    dbg(`Shutting down instance manager`)
    await reduce(
      instances,
      (p, instance) => {
        return p.then(() => instance.shutdown())
      },
      Promise.resolve()
    )
  })

  const maintenance = async (instanceId: InstanceId) => {}
  return { getInstance, shutdown, maintenance }
}
