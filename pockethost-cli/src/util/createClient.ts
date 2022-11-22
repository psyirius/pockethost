import { createPromiseHelper, InstanceFields } from '@pockethost/common'
import pocketbaseEs from 'pocketbase'
import { LocalStorageCompatibleAuthStore } from '../providers/LocalStorageCompatibleAuthStore'
import { info, logger } from './logger'
import { getProject, localStorage } from './project'

export const createClient = () => {
  const host = getProject().host || `pockethost-central.pockethost.io`
  const endpoint = `https://${host}`
  info(`PocketHost endpoint: ${endpoint}`)

  const client = new pocketbaseEs(
    endpoint,
    new LocalStorageCompatibleAuthStore(`auth`, localStorage)
  )

  const { safeCatch } = createPromiseHelper({ logger })

  const logIn = safeCatch(`logIn`, async (email: string, password: string) => {
    await client
      .collection('users')
      .authWithPassword(email, password)
      .catch((e) => {
        console.log(e)
      })
  })

  const getInstances = safeCatch(`getInstances`, async () => {
    const { model } = client.authStore
    if (!model) {
      throw new Error(`Auth required`)
    }
    const instances = await client
      .collection('instances')
      .getFullList<InstanceFields>(100, { filter: `uid = '${model.id}'` })
    return instances
  })

  return { logIn, getInstances }
}
