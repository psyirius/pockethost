import { ProxyServiceApi } from '../ProxyService'

export type DockerHealthCheckConfig = {
  proxyService: ProxyServiceApi
}

export type DockerHealthCheck = ReturnType<
  typeof createDockerHealthCheckMiddleware
>
export const createDockerHealthCheckMiddleware = (
  config: DockerHealthCheckConfig
) => {
  const { proxyService } = config
  const { onRequest } = proxyService

  const unsub = onRequest(async ({ host, req, res }) => {
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
  })

  const shutdown = async () => {
    await unsub()
  }
  return {
    shutdown,
  }
}
