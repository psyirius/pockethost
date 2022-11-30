import { InstanceFields } from '@pockethost/schema'
import cookie from 'cookie'
import { existsSync } from 'fs'
import { createServer } from 'http'
import httpProxy from 'http-proxy'
import { join } from 'path'
import pocketbaseEs from 'pocketbase'
import { open } from 'sqlite'
import { Database } from 'sqlite3'
import { AsyncReturnType } from 'type-fest'
import {
  DAEMON_PB_DATA_DIR,
  DAEMON_PB_PORT_BASE,
  PUBLIC_APP_DOMAIN,
  PUBLIC_APP_PROTOCOL,
  PUBLIC_PB_SUBDOMAIN,
} from '../constants'
import { mkInternalUrl } from '../util/internal'
import { dbg, error, info } from '../util/logger'
import { InstanceServiceApi } from './InstanceService/InstanceService'

export type ProxyServiceApi = AsyncReturnType<typeof createProxyService>

export const createProxyService = async (
  instanceManager: InstanceServiceApi
) => {
  const proxy = httpProxy.createProxyServer({})

  const server = createServer(async (req, res) => {
    // dbg(`Incoming request ${req.headers.host}${req.url}`)
    // dbg(req.headers)

    try {
      const host = req.headers.host
      if (!host) {
        throw new Error(`Host not found`)
      }

      /**
       * Docker health check
       */
      if (host === `daemon:3000`) {
        if (req.url === `/ping`) {
          res.writeHead(200, {
            'Content-Type': `text/plain`,
          })
          res.end(`pong`)
          return
        }
        throw new Error(`Got an invalid internal Docker request: ${req.url}`)
      }

      const [subdomain, ...junk] = host.split('.')
      if (!subdomain) {
        throw new Error(`${host} has no subdomain.`)
      }
      if (subdomain === PUBLIC_PB_SUBDOMAIN) {
        const target = mkInternalUrl(DAEMON_PB_PORT_BASE)

        /**
         * Realtime logging
         */
        if (req.url?.startsWith('/logs')) {
          dbg(`Got a log request`)
          if (!req.headers.cookie) {
            throw new Error(`Expected cookie header here`)
          }
          const parsed = cookie.parse(req.headers.cookie)
          const { token } = parsed

          if (!token) {
            throw new Error(
              `Expected 'token' cookie, but found ${JSON.stringify(parsed)}`
            )
          }

          const client = new pocketbaseEs(target)
          client.authStore.loadFromCookie(token)
          dbg(`Cookie here is`, client.authStore.isValid)
          await client.collection('users').authRefresh()
          if (!client.authStore.isValid) {
            throw new Error(`Cookie is invalid her`)
          }
          const user = client.authStore.model
          if (!user) {
            throw new Error(`Valid user expected here`)
          }
          dbg(`Cookie auth passed)`)
          const parts = req.url.split('/')
          const [, , instanceId] = parts
          if (!instanceId) {
            throw new Error(`Could not find instance ID in path ${req.url}`)
          }
          dbg(`Got a log request for instance ID ${instanceId}`)
          const instance = await client
            .collection('instances')
            .getOne<InstanceFields>(instanceId)
          if (!instance) {
            throw new Error(
              `instanceId ${instanceId} not found for user ${user.id}`
            )
          }
          dbg(`Instance is `, instance)
          const logDbPath = join(
            DAEMON_PB_DATA_DIR,
            instanceId,
            'worker',
            'logs.db'
          )
          dbg(`Attempting to load ${logDbPath}`)
          if (!existsSync(logDbPath)) {
            throw new Error(`Log path ${logDbPath} does not exist`)
          }
          const db = await open({ filename: logDbPath, driver: Database })
          dbg(`Database opened successfully`)
          db.db.addListener('change', (...args) => {
            dbg({ args })
          })
          dbg(`Change event registered`)

          return
        }

        dbg(`Forwarding proxy request for ${req.url} to instance ${target}`)
        proxy.web(req, res, { target })
        return
      }

      const instance = await instanceManager.getInstance(subdomain)
      if (!instance) {
        throw new Error(
          `${host} not found. Please check the instance URL and try again, or create one at ${PUBLIC_APP_PROTOCOL}://${PUBLIC_APP_DOMAIN}.`
        )
      }

      if (req.closed) {
        throw new Error(`Request already closed.`)
      }

      dbg(
        `Forwarding proxy request for ${req.url} to instance ${instance.internalUrl}`
      )

      const endRequest = instance.startRequest()
      req.on('close', endRequest)
      proxy.web(req, res, { target: instance.internalUrl })
    } catch (e) {
      const msg = `${e}`
      error(msg)
      res.writeHead(403, {
        'Content-Type': `text/plain`,
      })
      res.end(msg)
    }
  })

  info('daemon on port 3000')
  server.listen(3000)

  const shutdown = () => {
    info(`Shutting down proxy server`)
    server.close()
    instanceManager.shutdown()
  }

  return { shutdown }
}
