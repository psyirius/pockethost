import { browser, dev } from '$app/environment'
import { PUBLIC_PB_DOMAIN, PUBLIC_PB_SUBDOMAIN } from '$src/env'
import { createPocketbaseClient, type PocketbaseClient } from '@pockethost/client'
import { createLogger, createPromiseHelper } from '@pockethost/tools'
import { LocalAuthStore } from 'pocketbase'

export const client = (() => {
  let clientInstance: PocketbaseClient | undefined
  return () => {
    if (!browser) throw new Error(`PocketBase client not supported in SSR`)
    if (clientInstance) return clientInstance
    const logger = createLogger({ debug: dev })
    logger.info(`Initializing pocketbase client`)
    const url = `https://${PUBLIC_PB_SUBDOMAIN}.${PUBLIC_PB_DOMAIN}`
    const promiseHelper = createPromiseHelper({ logger })
    clientInstance = createPocketbaseClient({
      url,
      logger,
      promiseHelper,
      storageProvider: new LocalAuthStore()
    })
    return clientInstance
  }
})()
