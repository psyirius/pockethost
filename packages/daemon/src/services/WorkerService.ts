import {
  PublishBundlePayload,
  PublishBundlePayloadSchema,
  PublishBundleResult,
  RpcCommands,
} from '@pockethost/schema'
import { assertTruthy, newId } from '@pockethost/tools'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { DAEMON_PB_DATA_DIR } from '../constants'
import { PocketbaseClientApi } from '../db/PbClient'
import { dbg } from '../util/logger'
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
      return { bundleId }
    }
  )

  const shutdown = () => {}
  return {
    shutdown,
  }
}
