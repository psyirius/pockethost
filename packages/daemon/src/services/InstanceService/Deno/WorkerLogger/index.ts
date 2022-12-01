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
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

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
      await conn('logs').insert(_in)
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
      const db = await open({
        filename: logDbPath,
        driver: sqlite3.Database,
      })
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
