import { assertTruthy } from '@pockethost/tools'
import { RpcHandlerFactory } from '..'

import {
  PublishBundlePayload,
  PublishBundlePayloadSchema,
  PublishBundleResult,
  RpcCommands,
  StreamNames,
} from '@pockethost/schema'
import { newId } from '@pockethost/tools'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { DAEMON_PB_DATA_DIR } from '../../../constants'
import { dbg } from '../../../util/logger'
import { createWorkerLogger } from '../../InstanceService/Deno/WorkerLogger'

export const registerPublishBundleHandler: RpcHandlerFactory = ({
  client,
  rpcService: { registerCommand },
}) => {
  registerCommand<PublishBundlePayload, PublishBundleResult>(
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
    }
  )
}
