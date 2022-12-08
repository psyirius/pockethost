import { getInstanceService } from '$services/InstanceService/InstanceService'
import { PUBLIC_APP_DOMAIN, PUBLIC_APP_PROTOCOL } from '$src/constants'
import { dbg } from '$util/logger'
import { ProxyEventHandler, ProxyMiddleware } from '../ProxyService'

export type InstanceConfig = {}

export type Instance = ReturnType<typeof instance>
export const instance = async (
  config?: InstanceConfig
): Promise<ProxyMiddleware> => {
  const handle: ProxyEventHandler = async (
    { host, req, res, subdomain, proxy },
    isHandled
  ) => {
    if (isHandled) return // Already handled, do not process

    const instanceService = await getInstanceService()
    const instance = await instanceService.getInstanceBySubdomain(subdomain)
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
    return true
  }

  return {
    handle,
  }
}
