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
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import knex from 'knex'
import { dirname, join } from 'path'
import { DAEMON_PB_DATA_DIR } from '../constants'
import { PocketbaseClientApi } from '../db/PbClient'
import { dbg } from '../util/logger'
import { safeCatch } from '../util/promiseHelper'
import { RpcServiceApi } from './RpcService'

export type WorkerServiceConfig = {
  client: PocketbaseClientApi
  rpcService: RpcServiceApi
}
export const createWorkerService = async (config: WorkerServiceConfig) => {
  const { rpcService, client } = config

  rpcService.registerCommand<PublishBundlePayload, PublishBundleResult>(
    RpcCommands.PublishBundle,
    PublishBundlePayloadSchema,
    async (job) => {
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
        const logger = createWorkerLogger(instanceId)
        logger.write(bundleId, `Bundle added`)
      }
      return { bundleId }
    }
  )

  const shutdown = () => {}
  return {
    shutdown,
  }
}

const createWorkerLogger = (instanceId: InstanceId) => {
  const logDbPath = join(DAEMON_PB_DATA_DIR, instanceId, 'worker', 'logs.db')
  dbg(`logs path`, logDbPath)
  mkdirSync(dirname(logDbPath), { recursive: true })

  const conn = knex({
    client: 'sqlite3',
    connection: {
      filename: logDbPath,
    },
  })

  if (!existsSync(logDbPath)) {
    dbg(`Log db does not exist, creating`)
    await db
  }

  const write = safeCatch(
    `workerLogger:write`,
    async (bundleId: RecordId, message: string, stream: StreamNames) => {
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
