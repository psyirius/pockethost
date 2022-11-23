import { createPocketbaseClient, PocketbaseClient } from '@pockethost/client'
import { createPromiseHelper } from '@pockethost/tools'
import { LocalStorage } from 'node-localstorage'
import { join } from 'path'
import { PH_CACHE_FNAME, PH_HOST, PH_MOTHERSHIP } from '../env'
import { LocalStorageCompatibleAuthStore } from '../providers/LocalStorageCompatibleAuthStore'
import { dbg, logger } from './logger'
import { getProjectRoot } from './project'

export const client = (() => {
  let instance: PocketbaseClient | undefined
  return (host?: string) => {
    if (instance) return instance
    const url = `https://${PH_MOTHERSHIP}.${PH_HOST}`
    dbg(`Connecting to mothership ${url}`)
    const promiseHelper = createPromiseHelper({ logger })
    instance = createPocketbaseClient({
      url,
      logger,
      promiseHelper,
      storageProvider: new LocalStorageCompatibleAuthStore(
        `session`,
        new LocalStorage(join(getProjectRoot(), PH_CACHE_FNAME))
      ),
    })
    return instance
  }
})()
