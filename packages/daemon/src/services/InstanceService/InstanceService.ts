import { binFor } from '@pockethost/releases'
import { InstanceId, InstanceStatus } from '@pockethost/schema'
import {
  assertTruthy,
  createCleanupManager,
  createTimerManager,
} from '@pockethost/tools'
import { map, reduce } from '@s-libs/micro-dash'
import Bottleneck from 'bottleneck'
import getPort from 'get-port'
import { AsyncReturnType } from 'type-fest'
import {
  DAEMON_PB_IDLE_TTL,
  DAEMON_PB_PORT_BASE,
  PUBLIC_APP_DOMAIN,
  PUBLIC_APP_PROTOCOL,
} from '../../constants'
import { PocketbaseClientApi } from '../../db/PbClient'
import { mkInternalUrl } from '../../util/internal'
import { dbg, error, logger, warn } from '../../util/logger'
import { now } from '../../util/now'
import { safeCatch } from '../../util/promiseHelper'
import { PocketbaseProcess, spawnInstance } from '../../util/spawnInstance'
import { RpcServiceApi } from '../RpcService'
import { createDenoProcess } from './DenoProcess'

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
        const { currentWorkerBundleId } = instance
        const internalUrl = mkInternalUrl(newPort)
        if (currentWorkerBundleId) {
          const { shutdown } = await createDenoProcess({
            port: newPort,
            instance,
          })
          shutdownManager.add(shutdown)
        }

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
      } catch (e) {
        error(e)
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
