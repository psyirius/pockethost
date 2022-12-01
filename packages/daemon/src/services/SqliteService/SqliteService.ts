import { createCleanupManager, createEvent } from '@pockethost/tools'
import Bottleneck from 'bottleneck'
import { open } from 'sqlite'
import { Database } from 'sqlite3'
import { JsonObject } from 'type-fest'
import { logger } from '../../util/logger'

export type SqliteUnsubscribe = () => void
export type SqliteChangeHandler = (e: SqliteChangeEvent) => void
export type SqliteEventType = 'update' | 'insert' | 'delete'
export type SqliteChangeEvent = {
  table: string
  action: SqliteEventType
  record: JsonObject
}
export type SqliteServiceApi = {
  subscribe: (cb: SqliteChangeHandler) => SqliteUnsubscribe
}
export type SqliteServiceConfig = {}

export type SqliteService = ReturnType<typeof createSqliteService>

export const createSqliteService = (config: SqliteServiceConfig) => {
  const connections: { [_: string]: Promise<SqliteServiceApi> } = {}

  const cm = createCleanupManager({ logger: logger })

  const limiter = new Bottleneck({ maxConcurrent: 1 })

  const getDatabase = async (filename: string): Promise<SqliteServiceApi> => {
    if (!connections[filename]) {
      connections[filename] = new Promise<SqliteServiceApi>(async (resolve) => {
        const db = await open({ filename, driver: Database })

        db.db.addListener(
          'change',
          async (
            eventType: SqliteEventType,
            database: string,
            table: string,
            rowId: number
          ) => {
            if (eventType === 'delete') return // Not supported

            await limiter.schedule(async () => {
              const record = await db.get(
                `select * from ${table} where rowid = '${rowId}'`
              )
              const e: SqliteChangeEvent = { table, action: eventType, record }
              fireChange(e)
            })
          }
        )

        cm.add(() => {
          db.db.removeAllListeners()
          db.close()
        })

        const [onChange, fireChange] = createEvent<SqliteChangeEvent>()
        const api: SqliteServiceApi = {
          subscribe: onChange,
        }
        resolve(api)
      })
    }
    return connections[filename]!
  }

  const shutdown = async () => {
    await cm.shutdown()
  }
  return {
    getDatabase,
    shutdown,
  }
}
