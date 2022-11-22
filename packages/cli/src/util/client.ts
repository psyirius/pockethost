import { createPocketbaseClient, PocketbaseClient } from '@pockethost/client'
import { createPromiseHelper } from '@pockethost/tools'
import { LocalStorage } from 'node-localstorage'
import { join } from 'path'
import { PH_HOST } from '../env'
import { LocalStorageCompatibleAuthStore } from '../providers/LocalStorageCompatibleAuthStore'
import { dbg, info, logger } from './logger'
import { getProject, getProjectRoot } from './project'

export const client = (() => {
  let instance: PocketbaseClient | undefined
  return (host?: string) => {
    if (!host && instance) return instance
    info(`Initializing pocketbase client`)
    const _host = host || getProject()?.host || PH_HOST
    const url = `https://${_host}`
    dbg(`Connecting to host ${url}`)
    const promiseHelper = createPromiseHelper({ logger })
    instance = createPocketbaseClient({
      url,
      logger,
      promiseHelper,
      storageProvider: new LocalStorageCompatibleAuthStore(
        `session`,
        new LocalStorage(join(getProjectRoot()))
      ),
    })
    return instance
  }
})()
