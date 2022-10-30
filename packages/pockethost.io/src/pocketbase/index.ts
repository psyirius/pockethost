import { PUBLIC_PB_DOMAIN, PUBLIC_PB_SUBDOMAIN } from '$src/env'
import {
  createPocketbaseClient,
  type PocketbaseClientApi,
  type PocketbaseClientProps
} from './PocketbaseClient'

export const client = (() => {
  let clientInstance: PocketbaseClientApi | undefined
  return (props?: Partial<PocketbaseClientProps>) => {
    if (clientInstance) return clientInstance
    const url = `https://${PUBLIC_PB_SUBDOMAIN}.${PUBLIC_PB_DOMAIN}`
    const _props = { url, ...props }
    console.log(`Initializing pocketbase client`, _props)
    clientInstance = createPocketbaseClient(_props)
    return clientInstance
  }
})()
