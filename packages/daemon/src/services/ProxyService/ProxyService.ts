import { createEvent } from '@pockethost/tools'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import httpProxy from 'http-proxy'
import { AsyncReturnType } from 'type-fest'
import { PUBLIC_APP_DOMAIN, PUBLIC_APP_PROTOCOL } from '../../constants'
import { dbg, error, info } from '../../util/logger'

export type ProxyServiceApi = AsyncReturnType<typeof createProxyService>

export type ProxyRequestEvent = {
  host: string
  subdomain: string
  req: IncomingMessage
  res: ServerResponse<IncomingMessage>
}

export type ProxyServiceConfig = {}
export const createProxyService = async (config: ProxyServiceConfig) => {
  const {} = config

  const proxy = httpProxy.createProxyServer({})

  const [onRequest, fireRequest] = createEvent<ProxyRequestEvent>((payload) => {
    const { req, res } = payload
    res.writeHead(404, {
      'Content-Type': `text/plain`,
    })
    res.end(`No handler found for ${req.url}`)
    return true
  })

  const server = createServer(async (req, res) => {
    // dbg(`Incoming request ${req.headers.host}${req.url}`)
    // dbg(req.headers)

    try {
      const host = req.headers.host
      if (!host) {
        throw new Error(`Host not found`)
      }

      const [subdomain, ...junk] = host.split('.')
      if (!subdomain) {
        throw new Error(`${host} has no subdomain.`)
      }
      const handled = await fireRequest({ host, subdomain, req, res })

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
  }

  return { shutdown, onRequest, proxy }
}
