import { getClientService } from '$services/ClientService'
import { binFor } from '@pockethost/releases'
import {
  InstanceFields,
  InstanceId,
  InstanceStatus,
  RecordId,
} from '@pockethost/schema'
import {
  assertTruthy,
  createCleanupManager,
  createTimerManager,
  Unsubscribe,
} from '@pockethost/tools'
import { map, reduce } from '@s-libs/micro-dash'
import Bottleneck from 'bottleneck'
import getPort from 'get-port'
import { AsyncReturnType } from 'type-fest'
import { ServicesConfig } from '..'
import {
  DAEMON_PB_IDLE_TTL,
  DAEMON_PB_PORT_BASE,
  PUBLIC_APP_DOMAIN,
  PUBLIC_APP_PROTOCOL,
} from '../../constants'
import { mkInternalUrl } from '../../util/internal'
import { dbg, error, logger, warn } from '../../util/logger'
import { now } from '../../util/now'
import { safeCatch } from '../../util/promiseHelper'
import { PocketbaseProcess, spawnInstance } from '../../util/spawnInstance'
import { createDenoProcess, DenoApi } from './Deno/DenoProcess'

type InstanceApi = {
  process: PocketbaseProcess
  internalUrl: string
  port: number
  shutdown: () => Promise<void>
  startRequest: () => () => void
  reloadDeno: () => Promise<void>
}

export type InstanceServiceConfig = {}

export type InstanceServiceApi = AsyncReturnType<typeof createInstanceService>
export const createInstanceService = async (config: InstanceServiceConfig) => {
  const instanceApisBySubdomain: { [_: string]: InstanceApi } = {}
  const instanceApisById: { [_: RecordId]: InstanceApi } = {}

  const limiter = new Bottleneck({ maxConcurrent: 1 })

  const _getOrSpawnInstance = async (instance: InstanceFields) => {
    const { subdomain } = instance

    const client = await getClientService()
    const shutdownManager = createCleanupManager({ logger })
    try {
      await client.updateInstanceStatus(instance.id, InstanceStatus.Port)
      shutdownManager.add(() =>
        client.updateInstanceStatus(instance.id, InstanceStatus.Idle)
      )

      dbg(`${subdomain} found in DB`)
      const exclude = map(instanceApisBySubdomain, (i) => i.port)
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
      const internalUrl = mkInternalUrl(newPort)

      const reloadDeno = (() => {
        let cancel: Unsubscribe | undefined = undefined
        let api: DenoApi | undefined = undefined

        return async () => {
          /**
           * Shut down existing Deno process if it's running
           */

          /**
           * Spawn Deno worker if available
           */
          const [freshInstance] = await client.getInstanceById(instance.id)
          if (!freshInstance) {
            throw new Error(`Instance ${instance.id} could not be freshened.`)
          }
          const { currentWorkerBundleId } = freshInstance
          dbg(`Current Deno worker bundle ID is ${currentWorkerBundleId}`)
          if (currentWorkerBundleId) {
            // Shut down any old instance first
            if (cancel) {
              dbg(`Canceling old Deno shutdown`)
              cancel()
            }
            if (api?.shutdown) {
              dbg(`Shutting down old Deno instance for ${instance.id}`)
              await api.shutdown()
            }

            // Launch new instance
            dbg(
              `Launching new Deno instance for ${instance.id}:${currentWorkerBundleId}`
            )
            api = await createDenoProcess({
              port: newPort,
              instance: freshInstance,
            })
            cancel = shutdownManager.add(api.shutdown)
          }
        }
      })()
      reloadDeno()

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
        reloadDeno,
      }

      instanceApisBySubdomain[subdomain] = _api
      instanceApisById[instance.id] = _api
      shutdownManager.add(() => {
        delete instanceApisBySubdomain[subdomain]
        delete instanceApisById[instance.id]
      })
      await client.updateInstanceStatus(instance.id, InstanceStatus.Running)
      dbg(`${_api.internalUrl} is running`)
      return instanceApisBySubdomain[subdomain]
    } catch (e) {
      error(e)
      await shutdownManager.shutdown()
    }
  }

  const getInstanceById = async (instanceId: RecordId) =>
    limiter.schedule(async () => {
      {
        const instanceApi = instanceApisById[instanceId]
        if (instanceApi) {
          // dbg(`Found in cache: ${subdomain}`)
          return instanceApi
        }
      }
      const client = await getClientService()
      const [instance, owner] = await client.getInstanceById(instanceId)
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`)
      }

      if (!owner?.verified) {
        throw new Error(
          `Log in at ${PUBLIC_APP_PROTOCOL}://${PUBLIC_APP_DOMAIN} to verify your account.`
        )
      }
      return _getOrSpawnInstance(instance)
    })

  const getInstanceBySubdomain = async (subdomain: string) =>
    limiter.schedule(async () => {
      // dbg(`Getting instance ${subdomain}`)
      {
        const instanceApi = instanceApisBySubdomain[subdomain]
        if (instanceApi) {
          // dbg(`Found in cache: ${subdomain}`)
          return instanceApi
        }
      }

      dbg(`Checking ${subdomain} for permission`)
      const client = await getClientService()
      const [instance, owner] = await client.getInstanceBySubdomain(subdomain)
      if (!instance) {
        throw new Error(`${subdomain} not found`)
      }

      if (!owner?.verified) {
        throw new Error(
          `Log in at ${PUBLIC_APP_PROTOCOL}://${PUBLIC_APP_DOMAIN} to verify your account.`
        )
      }
      return _getOrSpawnInstance(instance)
    })

  const shutdown = safeCatch(`InstanceManager:shutdown`, async () => {
    dbg(`Shutting down instance manager`)
    await reduce(
      instanceApisBySubdomain,
      (p, instance) => {
        return p.then(() => instance.shutdown())
      },
      Promise.resolve()
    )
  })

  const maintenance = async (instanceId: InstanceId) => {}
  return { getInstanceBySubdomain, getInstanceById, shutdown, maintenance }
}

let _service: InstanceServiceApi | undefined
export const getInstanceService = async (config?: ServicesConfig) => {
  if (config) {
    _service?.shutdown()
    _service = await createInstanceService(config)
    dbg(`Instance service initialized`)
  }
  if (!_service) {
    throw new Error(`Attempt to use instance service before initialization`)
  }
  return _service
}
