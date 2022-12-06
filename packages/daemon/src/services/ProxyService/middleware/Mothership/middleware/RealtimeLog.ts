import { getSqliteService } from '$services/SqliteService/SqliteService'
import { DAEMON_PB_DATA_DIR } from '$src/constants'
import { logger } from '$util/logger'
import { InstanceFields, RecordId, WorkerLogFields } from '@pockethost/schema'
import Bottleneck from 'bottleneck'
import { text } from 'node:stream/consumers'
import { join } from 'path'
import pocketbaseEs from 'pocketbase'
import { JsonifiableObject } from 'type-fest/source/jsonifiable'
import { MothershipEventHandler, MothershipMiddleware } from '../Mothership'

export type RealtimeLogConfig = {}

const mkEvent = (name: string, data: JsonifiableObject) => {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`
}

export type RealtimeLog = ReturnType<typeof realtimeLog>
export const realtimeLog = (
  config?: RealtimeLogConfig
): MothershipMiddleware => {
  const handle: MothershipEventHandler = async (e) => {
    const { dbg } = logger.create(`realtimeLog`)
    const { req, internalPocketbaseUrl, res } = e
    if (!req.url?.startsWith('/logs')) return

    const write = async (data: any) => {
      return new Promise<void>((resolve) => {
        if (!res.write(data)) {
          // dbg(`Waiting for drain after`, data)
          res.once('drain', resolve)
        } else {
          // dbg(`Waiting for nexttick`, data)
          process.nextTick(resolve)
        }
      })
    }

    /**
     * Extract query params
     */
    dbg(`Got a log request`)
    const parsed = new URL(req.url, `https://${req.headers.host}`)
    if (req.method === 'OPTIONS') {
      // https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
      res.setHeader('Access-Control-Max-Age', 86400)
      res.statusCode = 204
      res.end()
      return
    }
    // dbg(`Parsed URL is`, parsed)

    const json = await text(req)
    dbg(`JSON payload is`, json)
    const payload = JSON.parse(json)
    dbg(`Parsed payload is`, parsed)
    const { instanceId, auth, n: nInitialRecords } = payload

    if (!instanceId) {
      throw new Error(`instanceId query param required in ${req.url}`)
    }
    if (!auth) {
      throw new Error(`Expected 'auth' query param, but found ${req.url}`)
    }

    /**
     * Validate auth token
     */
    const client = new pocketbaseEs(internalPocketbaseUrl)
    client.authStore.loadFromCookie(auth)
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
      'Content-Type': 'text/event-stream; charset=UTF-8',
      Connection: 'keep-alive',
      'Cache-Control': 'no-store',
    })

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
      limiter.schedule(() => write(evt))
    })
    req.on('close', () => {
      limiter.stop()
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
        limiter.schedule(async () => {
          if (_seenIds?.[rec.id]) return // Skip if update already emitted
          const evt = mkEvent(`log`, rec)
          dbg(
            `Dispatching SSE initial log event from ${instance.subdomain} (${instance.id})`,
            evt
          )
          return write(evt)
        })
      })
      limiter.schedule(async () => {
        // Set seenIds to `undefined` so the subscribe listener stops tracking them.
        _seenIds = undefined
      })
    }

    return true
  }

  return {
    handle,
  }
}
