import { ProxyMiddleware } from '../ProxyService'

export type DockerHealthCheckConfig = {}

export type DockerHealthCheck = ReturnType<typeof dockerHealthCheck>
export const dockerHealthCheck = (
  config?: DockerHealthCheckConfig
): ProxyMiddleware => {
  return {
    handle: async ({ host, req, res }) => {
      /**
       * Docker health check
       */
      if (host !== `daemon:3000`) return

      if (req.url !== `/ping`) {
        throw new Error(`Got an invalid internal Docker request: ${req.url}`)
      }
      res.writeHead(200, {
        'Content-Type': `text/plain`,
      })
      res.end(`pong`)
      return true
    },
  }
}
