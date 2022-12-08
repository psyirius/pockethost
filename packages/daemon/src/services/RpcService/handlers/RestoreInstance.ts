import { getClientService } from '$services/ClientService'
import {
  RestoreInstancePayload,
  RestoreInstancePayloadSchema,
  RestoreInstanceResult,
  RpcCommands,
} from '@pockethost/schema'
import { assertTruthy } from '@pockethost/tools'
import { getRpcService, RpcHandlerFactory } from '..'

export const registerRestoreInstanceHandler: RpcHandlerFactory = async () => {
  const client = await getClientService()
  const rpcService = await getRpcService()
  const { registerCommand } = rpcService

  registerCommand<RestoreInstancePayload, RestoreInstanceResult>(
    RpcCommands.RestoreInstance,
    RestoreInstancePayloadSchema,
    async (job) => {
      const { payload } = job
      const { backupId } = payload
      const backup = await client.getBackupJob(backupId)
      assertTruthy(backup, `Backup ${backupId} not found`)
      const instance = await client.getInstance(backup.instanceId)
      assertTruthy(instance, `Instance ${backup.instanceId} not found`)
      assertTruthy(
        instance.uid === job.userId,
        `Backup ${backupId} is not owned by user ${job.userId}`
      )

      /**
       * Restore strategy:
       *
       * 1. Place instance in maintenance mode
       * 2. Shut down instance
       * 3. Back up
       * 4. Restore
       * 5. Lift maintenance mode
       */
      const restore = await client.createBackup(instance.id)
      return { restoreId: restore.id }
    }
  )
}
