import {
  InstanceId,
  PublishBundlePayload,
  PublishBundlePayloadSchema,
  PublishBundleResult,
  RecordId,
  RpcCommands,
  StreamNames,
  WorkerLogFields_Create,
} from '@pockethost/schema'
import { assertTruthy, newId, pocketNow } from '@pockethost/tools'
import { mkdirSync, writeFileSync } from 'fs'
import knex from 'knex'
import { dirname, join } from 'path'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { DAEMON_PB_DATA_DIR } from '../../constants'
import { PocketbaseClientApi } from '../../db/PbClient'
import { dbg } from '../../util/logger'
import { safeCatch } from '../../util/promiseHelper'
import { RpcServiceApi } from '../RpcService'

export type WorkerServiceConfig = {
  client: PocketbaseClientApi
  rpcService: RpcServiceApi
}
export const createWorkerService = async (config: WorkerServiceConfig) => {
  const { rpcService, client } = config

  rpcService.registerCommand<PublishBundlePayload, PublishBundleResult>(
    RpcCommands.PublishBundle,
    PublishBundlePayloadSchema,
    safeCatch(`${RpcCommands.PublishBundle} handler`, async (job) => {
      dbg(`Got a publish job`, job)
      const { payload } = job
      const { instanceId, bundle } = payload
      const instance = await client.getInstance(instanceId)
      assertTruthy(instance, `Instance ${instanceId} not found`)
      assertTruthy(
        instance.uid === job.userId,
        `Instance ${instanceId} is not owned by user ${job.userId}`
      )
      const bundleId = newId()
      dbg(`New bundle id is ${bundleId}`)

      {
        const bundlePath = join(
          DAEMON_PB_DATA_DIR,
          instanceId,
          'worker',
          'bundles',
          `${bundleId}.js`
        )
        dbg(`Bundle path`, bundlePath)
        mkdirSync(dirname(bundlePath), { recursive: true })
        writeFileSync(bundlePath, bundle)
      }
      {
        const logger = await createWorkerLogger(instanceId)
        await logger.write(bundleId, `Bundle added`, StreamNames.System)
        await client.updateInstance(instanceId, {
          currentWorkerBundleId: bundleId,
        })
        await logger.write(
          bundleId,
          `Bundle is now the active bundle for instance ${instanceId}`,
          StreamNames.System
        )
      }
      return { bundleId }
    })
  )

  const shutdown = () => {}
  return {
    shutdown,
  }
}

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

export const createWorkerLogger = (() => {
  const instances: {
    [instanceId: InstanceId]: Promise<WorkerLogger>
  } = {}

  return (instanceId: InstanceId) => {
    if (instances[instanceId]) return instances[instanceId]!

    const logDbPath = join(DAEMON_PB_DATA_DIR, instanceId, 'worker', 'logs.db')
    dbg(`logs path`, logDbPath)
    mkdirSync(dirname(logDbPath), { recursive: true })

    instances[instanceId] = (async () => {
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
      return api
    })()

    return instances[instanceId]!
  }
})()
