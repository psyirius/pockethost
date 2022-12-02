import {
  MiddlewareProvider,
  ProxyEventHandler,
  ProxyMiddleware,
  ProxyRequestEvent,
  ProxyServiceApi,
} from '$services/ProxyService/ProxyService'
import { DAEMON_PB_PORT_BASE, PUBLIC_PB_SUBDOMAIN } from '$src/constants'
import { mkInternalUrl } from '$util/internal'
import { dbg } from '$util/logger'
import { createEvent, EventHandler } from '@pockethost/tools'

export type MothershipRequestEvent = ProxyRequestEvent & {
  internalPocketbaseUrl: string
}

export type MothershipConfig = {
  proxyService: ProxyServiceApi
}

export type MothershipEventHandler = EventHandler<MothershipRequestEvent>
export type MothershipMiddleware = {
  handle: MothershipEventHandler
}

export type Mothership = ReturnType<typeof mothership>

export const mothership = async (
  config?: MothershipConfig
): Promise<ProxyMiddleware & MiddlewareProvider<MothershipRequestEvent>> => {
  const [onRequest, fireRequest] = createEvent<MothershipRequestEvent>()

  const handle: ProxyEventHandler = async (e) => {
    const { subdomain, req, res, proxy } = e
    if (subdomain !== PUBLIC_PB_SUBDOMAIN) return
    const internalPocketbaseUrl = mkInternalUrl(DAEMON_PB_PORT_BASE)
    const handled = await fireRequest({ ...e, internalPocketbaseUrl }, true)
    if (handled) return true
    dbg(
      `Forwarding proxy request for ${req.url} to instance ${internalPocketbaseUrl}`
    )
    proxy.web(req, res, { target: internalPocketbaseUrl })
    return true
  }

  return {
    handle,
    use: onRequest,
  }
}
