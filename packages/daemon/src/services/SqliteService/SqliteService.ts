import { createCleanupManager, createEvent } from '@pockethost/tools'
import Bottleneck from 'bottleneck'
import { Database as SqliteDatabase, open } from 'sqlite'
import { Database } from 'sqlite3'
import { JsonObject } from 'type-fest'
import { ServicesConfig } from '..'
import { logger } from '../../util/logger'

export type SqliteUnsubscribe = () => void
export type SqliteChangeHandler<TRecord extends JsonObject> = (
  e: SqliteChangeEvent<TRecord>
) => void
export type SqliteEventType = 'update' | 'insert' | 'delete'
export type SqliteChangeEvent<TRecord extends JsonObject> = {
  table: string
  action: SqliteEventType
  record: TRecord
}
export type SqliteServiceApi = {
  all: SqliteDatabase['all']
  get: SqliteDatabase['get']
  migrate: SqliteDatabase['migrate']
  subscribe: <TRecord extends JsonObject>(
    cb: SqliteChangeHandler<TRecord>
  ) => SqliteUnsubscribe
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
              const e: SqliteChangeEvent<any> = {
                table,
                action: eventType,
                record,
              }
              fireChange(e)
            })
          }
        )

        cm.add(() => {
          db.db.removeAllListeners()
          db.close()
        })
        db.migrate

        const [onChange, fireChange] = createEvent<SqliteChangeEvent<any>>()
        const api: SqliteServiceApi = {
          all: db.all.bind(db),
          get: db.get.bind(db),
          migrate: db.migrate.bind(db),
          subscribe: onChange,
        }
        resolve(api)
      })
    }
    return connections[filename]!
  }

  const shutdown = async () => {
    await limiter.stop()
    await cm.shutdown()
  }
  return {
    getDatabase,
    shutdown,
  }
}

let _service: SqliteService | undefined
export const getSqliteService = async (config?: ServicesConfig) => {
  if (config) {
    _service?.shutdown()
    _service = await createSqliteService(config)
  }
  if (!_service) {
    throw new Error(`Attempt to use Sqlite service before initialization`)
  }
  return _service
}
