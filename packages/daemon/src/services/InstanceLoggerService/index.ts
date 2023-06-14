import { DAEMON_PB_DATA_DIR } from '$constants'
import { SqliteChangeEvent, sqliteService } from '$services'
import {
  InstanceId,
  InstanceLogFields,
  InstanceLogFields_Create,
  Logger,
  mkSingleton,
  newId,
  pocketNow,
  RecordId,
  safeCatch,
  SingletonBaseConfig,
  StreamNames,
} from '@pockethost/common'
import { mkdirSync } from 'fs'
import knex from 'knex'
import { dirname, join } from 'path'
import { AsyncReturnType } from 'type-fest'

export type InstanceLogger = AsyncReturnType<typeof mkApi>
const mkApi = async (logDbPath: string, logger: Logger) => {
  const _dbLogger = logger.create(`${logDbPath}`)
  const { dbg } = _dbLogger

  const { getDatabase } = sqliteService()
  const db = await getDatabase(logDbPath)

  const conn = knex({
    client: 'sqlite3',
    connection: {
      filename: logDbPath,
    },
    useNullAsDefault: true,
  })

  const write = safeCatch(
    `write`,
    _dbLogger,
    async (message: string, stream: StreamNames = StreamNames.Info) => {
      const _in: InstanceLogFields_Create = {
        id: newId(),
        message,
        stream,
        created: pocketNow(),
        updated: pocketNow(),
      }
      const sql = conn('logs').insert(_in).toString()
      dbg(`Writing log ${JSON.stringify(_in)} ${sql}`)
      await db.exec(sql)
    }
  )

  const subscribe = (cb: (e: SqliteChangeEvent<InstanceLogFields>) => void) => {
    let _seenIds: { [_: RecordId]: boolean } | undefined = {}

    const unsub = db.subscribe<InstanceLogFields>((e) => {
      // dbg(`Caught db modification ${logDbPath}`, e)
      const { table, record } = e
      if (table !== 'logs') return
      if (_seenIds) {
        _seenIds[record.id] = true
      }
      cb(e)
    })
    return unsub
  }

  const fetch = async (limit: number = 100) => {
    return db.all<InstanceLogFields[]>(
      `select * from logs order by created desc limit ${limit}`
    )
  }

  return { write, subscribe, fetch }
}

const instances: {
  [instanceId: InstanceId]: Promise<InstanceLogger>
} = {}

export const createInstanceLogger = (
  instanceId: InstanceId,
  logger: Logger
) => {
  if (!instances[instanceId]) {
    instances[instanceId] = new Promise<InstanceLogger>(async (resolve) => {
      const _workerLogger = logger.create(`InstanceLogger`)
      const { dbg } = _workerLogger

      const logDbPath = join(
        DAEMON_PB_DATA_DIR,
        instanceId,
        'pb_data',
        'instance_logs.db'
      )

      dbg(`logs path`, logDbPath)
      mkdirSync(dirname(logDbPath), { recursive: true })

      dbg(`Running migrations`)
      const { getDatabase } = sqliteService()
      const db = await getDatabase(logDbPath)
      await db.migrate({
        migrationsPath: join(__dirname, 'migrations'),
      })

      const api = await mkApi(logDbPath, _workerLogger)
      await api.write(`Ran migrations`, StreamNames.System)
      resolve(api)
    })
  }

  return instances[instanceId]!
}

export type InstanceLoggerServiceConfig = SingletonBaseConfig

export const instanceLoggerService = mkSingleton(
  (config: InstanceLoggerServiceConfig) => {
    const { logger } = config
    const { dbg } = logger.create(`InstanceLoggerService`)
    dbg(`Starting up`)
    return {
      get: createInstanceLogger,
      shutdown() {
        dbg(`Shutting down`)
      },
    }
  }
)
