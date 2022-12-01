import { SqliteService } from '$services/SqliteService/SqliteService'
import { DAEMON_PB_DATA_DIR } from '$src/constants'
import { dbg } from '$util/logger'
import { InstanceFields } from '@pockethost/schema'
import cookie from 'cookie'
import { join } from 'path'
import pocketbaseEs from 'pocketbase'
import { JsonifiableObject } from 'type-fest/source/jsonifiable'
import { Mothership } from '../Mothership'

export type RealtimeLogConfig = {
  mothershipMiddleware: Mothership
  sqliteService: SqliteService
}

const mkEvent = (name: string, data: JsonifiableObject) => {
  return [`event: ${name}`, `data: ${JSON.stringify(data)}`, '', ''].join('\n')
}

export type RealtimeLog = ReturnType<typeof createRealtimeLogMiddleware>
export const createRealtimeLogMiddleware = (config: RealtimeLogConfig) => {
  const { sqliteService, mothershipMiddleware } = config
  const { onRequest } = mothershipMiddleware

  const unsub = onRequest(async (e) => {
    const { req, internalPocketbaseUrl, res } = e
    if (!req.url?.startsWith('/logs')) return

    dbg(`Got a log request`)
    if (!req.headers.cookie) {
      throw new Error(`Expected cookie header here`)
    }
    const parsed = cookie.parse(req.headers.cookie)
    const { token } = parsed

    if (!token) {
      throw new Error(
        `Expected 'token' cookie, but found ${JSON.stringify(parsed)}`
      )
    }

    const client = new pocketbaseEs(internalPocketbaseUrl)
    client.authStore.loadFromCookie(token)
    dbg(`Cookie here is`, client.authStore.isValid)
    await client.collection('users').authRefresh()
    if (!client.authStore.isValid) {
      throw new Error(`Cookie is invalid her`)
    }
    const user = client.authStore.model
    if (!user) {
      throw new Error(`Valid user expected here`)
    }
    dbg(`Cookie auth passed)`)
    const parts = req.url.split('/')
    const [, , instanceId] = parts
    if (!instanceId) {
      throw new Error(`Could not find instance ID in path ${req.url}`)
    }
    dbg(`Got a log request for instance ID ${instanceId}`)
    const instance = await client
      .collection('instances')
      .getOne<InstanceFields>(instanceId)
    if (!instance) {
      throw new Error(`instanceId ${instanceId} not found for user ${user.id}`)
    }
    dbg(`Instance is `, instance)
    const logDbPath = join(DAEMON_PB_DATA_DIR, instanceId, 'worker', 'logs.db')
    dbg(`Attempting to load ${logDbPath}`)

    const api = await sqliteService.getDatabase(logDbPath)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    })
    const unsub = api.subscribe((e) => {
      const { table, record } = e
      if (table !== 'logs') return
      const evt = mkEvent(`log`, record)
      dbg(
        `Dispatching SSE log event from ${instance.subdomain} (${instance.id})`,
        evt
      )
      res.write(evt)
    })
    req.on('close', () => {
      dbg(
        `SSE request for ${instance.subdomain} (${instance.id}) closed. Unsubscribing.`
      )
      unsub()
    })

    return true
  })

  return {
    shutdown: unsub,
  }
}
