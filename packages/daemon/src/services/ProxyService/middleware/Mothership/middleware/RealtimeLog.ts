import { getSqliteService } from '$services/SqliteService/SqliteService'
import { DAEMON_PB_DATA_DIR } from '$src/constants'
import { logger } from '$util/logger'
import { InstanceFields, RecordId, WorkerLogFields } from '@pockethost/schema'
import Bottleneck from 'bottleneck'
import { join } from 'path'
import pocketbaseEs from 'pocketbase'
import { JsonifiableObject } from 'type-fest/source/jsonifiable'
import { MothershipEventHandler, MothershipMiddleware } from '../Mothership'

export type RealtimeLogConfig = {}

const mkEvent = (name: string, data: JsonifiableObject) => {
  return [`event: ${name}`, `data: ${JSON.stringify(data)}`, '', ''].join('\n')
}

export type RealtimeLog = ReturnType<typeof realtimeLog>
export const realtimeLog = (
  config?: RealtimeLogConfig
): MothershipMiddleware => {
  const handle: MothershipEventHandler = async (e) => {
    const { dbg } = logger.create(`realtimeLog`)
    const { req, internalPocketbaseUrl, res } = e
    if (!req.url?.startsWith('/logs')) return

    /**
     * Extract query params
     */
    dbg(`Got a log request`)
    const parsed = new URL(req.url, `https://${req.headers.host}`)
    dbg(`Parsed URL is`, parsed)

    const { searchParams } = parsed
    const instanceId = searchParams.get('instanceId')
    if (!instanceId) {
      throw new Error(`instanceId query param required in ${req.url}`)
    }
    const nInitialRecords = searchParams.get('n') || 0
    const token = searchParams.get('auth')
    if (!token) {
      throw new Error(`Expected 'auth' query param, but found ${req.url}`)
    }

    /**
     * Validate auth token
     */
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

    /**
     * Validate instance and ownership
     */
    dbg(`Got a log request for instance ID ${instanceId}`)
    const instance = await client
      .collection('instances')
      .getOne<InstanceFields>(instanceId)
    if (!instance) {
      throw new Error(`instanceId ${instanceId} not found for user ${user.id}`)
    }
    dbg(`Instance is `, instance)

    const limiter = new Bottleneck({ maxConcurrent: 1 })

    /**
     * Get a database connection
     */
    const logDbPath = join(DAEMON_PB_DATA_DIR, instanceId, 'worker', 'logs.db')
    dbg(`Attempting to load ${logDbPath}`)
    const sqliteService = await getSqliteService()
    const db = await sqliteService.getDatabase(logDbPath)

    /**
     * Start the stream
     */
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    })
    res.flushHeaders()

    /**
     * Track the IDs we send so we don't accidentally send old
     * records in the initial burst (if one is requested)
     */
    let _seenIds: { [_: RecordId]: boolean } | undefined = {}

    const unsub = db.subscribe<WorkerLogFields>((e) => {
      const { table, record } = e
      if (table !== 'logs') return
      if (_seenIds) {
        _seenIds[record.id] = true
      }
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

    /**
     * Send initial batch if requested
     */
    if (nInitialRecords > 0) {
      dbg(`Fetching initial ${nInitialRecords} logs to prime history`)
      const recs = await db.all<WorkerLogFields[]>(
        `select * from logs order by updated limit ${nInitialRecords}`
      )
      recs.forEach((rec) => {
        if (_seenIds?.[rec.id]) return
        const evt = mkEvent(`log`, rec)
        dbg(
          `Dispatching SSE initial log event from ${instance.subdomain} (${instance.id})`,
          evt
        )
        res.write(evt)
      })

      // Set seenIds to `undefined` so the subscribe listener stops tracking them.
      _seenIds = undefined
    }

    return true
  }

  return {
    handle,
  }
}
