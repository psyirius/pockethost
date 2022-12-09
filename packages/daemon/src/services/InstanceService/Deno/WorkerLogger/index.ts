import { getSqliteService } from '$services/SqliteService/SqliteService'
import { DAEMON_PB_DATA_DIR } from '$src/constants'
import { dbg } from '$util/logger'
import { safeCatch } from '$util/promiseHelper'
import {
  InstanceId,
  RecordId,
  StreamNames,
  WorkerLogFields_Create,
} from '@pockethost/schema'
import { newId, pocketNow } from '@pockethost/tools'
import { mkdirSync } from 'fs'
import knex from 'knex'
import { dirname, join } from 'path'

export type WorkerLogger = ReturnType<typeof mkApi>
const mkApi = (logDbPath: string) => {
  const conn = knex({
    client: 'sqlite3',
    connection: {
      filename: logDbPath,
    },
  })

  const write = safeCatch(
    `workerLogger:write`,
    async (
      bundleId: RecordId,
      message: string,
      stream: StreamNames = StreamNames.Info
    ) => {
      const _in: WorkerLogFields_Create = {
        id: newId(),
        bundleId,
        message,
        stream,
        created: pocketNow(),
        updated: pocketNow(),
      }
      const sql = conn('logs').insert(_in).toString()
      // dbg(`Writing log for ${logDbPath}`, _in, sql)
      const sqliteService = await getSqliteService()
      const db = await sqliteService.getDatabase(logDbPath)
      await db.exec(sql)
    }
  )

  return { write }
}

const instances: {
  [instanceId: InstanceId]: Promise<WorkerLogger>
} = {}

export const createWorkerLogger = (instanceId: InstanceId) => {
  if (!instances[instanceId]) {
    instances[instanceId] = new Promise<WorkerLogger>(async (resolve) => {
      const logDbPath = join(
        DAEMON_PB_DATA_DIR,
        instanceId,
        'worker',
        'logs.db'
      )
      dbg(`logs path`, logDbPath)
      mkdirSync(dirname(logDbPath), { recursive: true })

      dbg(`Running migrations`)
      const sqliteService = await getSqliteService()
      const db = await sqliteService.getDatabase(logDbPath)
      await db.migrate({
        migrationsPath: join(__dirname, 'migrations'),
      })

      const api = mkApi(logDbPath)
      await api.write(`migration`, `Ran migrations`, StreamNames.System)
      resolve(api)
    })
  }

  return instances[instanceId]!
}
