import {
  ProxyRequestEvent,
  ProxyServiceApi,
} from '$services/ProxyService/ProxyService'
import { DAEMON_PB_PORT_BASE, PUBLIC_PB_SUBDOMAIN } from '$src/constants'
import { mkInternalUrl } from '$util/internal'
import { dbg } from '$util/logger'
import { createEvent } from '@pockethost/tools'

export type MothershipRequestEvent = ProxyRequestEvent & {
  internalPocketbaseUrl: string
}

export type MothershipConfig = {
  proxyService: ProxyServiceApi
}

export type Mothership = ReturnType<typeof createMothershipMiddleware>
export const createMothershipMiddleware = (config: MothershipConfig) => {
  const { proxyService } = config
  const { onRequest: onProxyRequest, proxy } = proxyService

  const [onRequest, fireRequest] = createEvent<MothershipRequestEvent>()
  const unsub = onProxyRequest(async (e) => {
    const { subdomain, req, res } = e
    if (subdomain !== PUBLIC_PB_SUBDOMAIN) return
    const internalPocketbaseUrl = mkInternalUrl(DAEMON_PB_PORT_BASE)
    const handled = await fireRequest({ ...e, internalPocketbaseUrl })
    if (handled) return true
    dbg(
      `Forwarding proxy request for ${req.url} to instance ${internalPocketbaseUrl}`
    )
    proxy.web(req, res, { target: internalPocketbaseUrl })
    return true
  })

  const shutdown = async () => {
    await unsub()
  }
  return {
    onRequest,
    shutdown,
  }
}
