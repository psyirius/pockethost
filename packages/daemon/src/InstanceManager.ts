import { InstanceStatus } from '@pockethost/common'
import { forEachRight, map } from '@s-libs/micro-dash'
import Bottleneck from 'bottleneck'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import getPort from 'get-port'
import fetch from 'node-fetch'
import {
  DAEMON_PB_BIN_DIR,
  DAEMON_PB_DATA_DIR,
  DAEMON_PB_IDLE_TTL,
  DAEMON_PB_PASSWORD,
  DAEMON_PB_PORT_BASE,
  DAEMON_PB_USERNAME,
  PUBLIC_APP_DOMAIN,
  PUBLIC_APP_PROTOCOL,
  PUBLIC_PB_DOMAIN,
  PUBLIC_PB_PROTOCOL,
  PUBLIC_PB_SUBDOMAIN,
} from './constants'
import { collections_001 } from './migrations'
import { createPbClient } from './PbClient'

type Instance = {
  process: ChildProcessWithoutNullStreams
  internalUrl: string
  port: number
  heartbeat: (shouldStop?: boolean) => void
  shutdown: () => boolean
  startRequest: () => () => void
}

const tryFetch = (url: string) =>
  new Promise<void>((resolve, reject) => {
    const tryFetch = () => {
      console.log(`Trying to connect to instance ${url} `)
      fetch(url)
        .then(() => {
          console.log(`Connection to ${url} successful`)
          resolve()
        })
        .catch((e) => {
          console.error(`Could not connect to ${url}`)
          setTimeout(tryFetch, 1000)
        })
    }
    tryFetch()
  })

const mkInternalAddress = (port: number) => `127.0.0.1:${port}`
const mkInternalUrl = (port: number) => `http://${mkInternalAddress(port)}`

export const createInstanceManger = async () => {
  const instances: { [_: string]: Instance } = {}

  const _spawn = async (cfg: {
    subdomain: string
    port: number
    bin: string
  }) => {
    const { subdomain, port, bin } = cfg
    const cmd = `${DAEMON_PB_BIN_DIR}/${bin}`

    const args = [
      `serve`,
      `--dir`,
      `${DAEMON_PB_DATA_DIR}/${subdomain}/pb_data`,
      `--http`,
      mkInternalAddress(port),
    ]
    console.log(`Spawning ${subdomain}`, { cmd, args })
    const ls = spawn(cmd, args)

    ls.stdout.on('data', (data) => {
      console.log(`${subdomain} stdout: ${data}`)
    })

    ls.stderr.on('data', (data) => {
      console.error(`${subdomain} stderr: ${data}`)
    })

    ls.on('close', (code) => {
      console.log(`${subdomain} closed with code ${code}`)
    })
    ls.on('exit', (code) => {
      instances[subdomain]?.heartbeat(true)
      delete instances[subdomain]
      if (subdomain !== PUBLIC_PB_SUBDOMAIN) {
        client.updateInstanceStatus(subdomain, InstanceStatus.Idle)
      }
      console.log(`${subdomain} exited with code ${code}`)
    })
    ls.on('error', (err) => {
      console.log(`${subdomain} had error ${err}`)
    })

    await tryFetch(mkInternalUrl(port))
    return ls
  }

  const coreInternalUrl = mkInternalUrl(DAEMON_PB_PORT_BASE)
  const client = createPbClient(coreInternalUrl)
  const mainProcess = await _spawn({
    subdomain: PUBLIC_PB_SUBDOMAIN,
    port: DAEMON_PB_PORT_BASE,
    bin: 'pocketbase',
  })
  instances[PUBLIC_PB_SUBDOMAIN] = {
    process: mainProcess,
    internalUrl: coreInternalUrl,
    port: DAEMON_PB_PORT_BASE,
    heartbeat: () => {},
    shutdown: () => {
      console.log(`Shutting down instance ${PUBLIC_PB_SUBDOMAIN}`)
      return mainProcess.kill()
    },
    startRequest: () => () => {},
  }
  await tryFetch(coreInternalUrl)
  try {
    await client.adminAuthViaEmail(DAEMON_PB_USERNAME, DAEMON_PB_PASSWORD)
    await client.migrate(collections_001)
  } catch (e) {
    console.error(
      `***WARNING*** CANNOT AUTHENTICATE TO ${PUBLIC_PB_PROTOCOL}://${PUBLIC_PB_SUBDOMAIN}.${PUBLIC_PB_DOMAIN}/_/`
    )
    console.error(
      `***WARNING*** LOG IN MANUALLY, ADJUST .env, AND RESTART DOCKER`
    )
  }

  const limiter = new Bottleneck({ maxConcurrent: 1 })

  const getInstance = (subdomain: string) =>
    limiter.schedule(async () => {
      console.log(`Getting instance ${subdomain}`)
      {
        const instance = instances[subdomain]
        if (instance) {
          console.log(`Found in cache: ${subdomain}`)
          instance.heartbeat()
          return instance
        }
      }

      console.log(`Checking ${subdomain} for permission`)

      const [instance, owner] = await client.getInstanceBySubdomain(subdomain)
      if (!instance) {
        console.log(`${subdomain} not found`)
        return
      }

      if (!owner?.verified) {
        throw new Error(
          `Log in at ${PUBLIC_APP_PROTOCOL}://${PUBLIC_APP_DOMAIN} to verify your account.`
        )
      }

      await client.updateInstanceStatus(subdomain, InstanceStatus.Port)
      console.log(`${subdomain} found in DB`)
      const exclude = map(instances, (i) => i.port)
      const newPort = await getPort({
        port: 8090,
        exclude,
      }).catch((e) => {
        console.error(`Failed to get port for ${subdomain}`)
        throw e
      })
      console.log(`Found port for ${subdomain}: ${newPort}`)

      await client.updateInstanceStatus(subdomain, InstanceStatus.Starting)

      const childProcess = await _spawn({
        subdomain,
        port: newPort,
        bin: instance.bin || 'pocketbase',
      })

      const api: Instance = (() => {
        let openRequestCount = 0
        const internalUrl = mkInternalUrl(newPort)

        const RECHECK_TTL = 1000 // 1 second
        const _api: Instance = {
          process: childProcess,
          internalUrl,
          port: newPort,
          shutdown: () => {
            console.log(`Shutting down instance ${subdomain}`)
            return childProcess.kill()
          },
          heartbeat: (() => {
            let tid: ReturnType<typeof setTimeout>
            const _cleanup = () => {
              if (openRequestCount === 0) {
                _api.shutdown()
              } else {
                console.log(
                  `${openRequestCount} requests remain open on ${subdomain}`
                )
                tid = setTimeout(_cleanup, RECHECK_TTL)
              }
            }
            tid = setTimeout(_cleanup, DAEMON_PB_IDLE_TTL)
            return (shouldStop) => {
              clearTimeout(tid)
              if (!shouldStop) {
                tid = setTimeout(_cleanup, DAEMON_PB_IDLE_TTL)
              }
            }
          })(),
          startRequest: () => {
            openRequestCount++
            const id = openRequestCount

            console.log(`${subdomain} started new request ${id}`)
            return () => {
              openRequestCount--
              console.log(`${subdomain} ended request ${id}`)
            }
          },
        }
        return _api
      })()

      instances[subdomain] = api
      await client.updateInstanceStatus(subdomain, InstanceStatus.Running)
      console.log(`${api.internalUrl} is running`)
      return instances[subdomain]
    })

  const shutdown = () => {
    console.log(`Shutting down instance manager`)
    forEachRight(instances, (instance) => {
      instance.shutdown()
    })
  }
  return { getInstance, shutdown }
}
