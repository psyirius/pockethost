import {
  BackupInstancePayload,
  BackupInstancePayloadSchema,
  BackupInstanceResult,
  RpcCommands,
} from '@pockethost/schema'
import { assertTruthy } from '@pockethost/tools'
import { RpcHandlerFactory } from '..'

export const registerBackupInstanceHandler: RpcHandlerFactory = ({
  client,
  rpcService: { registerCommand },
}) => {
  registerCommand<BackupInstancePayload, BackupInstanceResult>(
    RpcCommands.BackupInstance,
    BackupInstancePayloadSchema,
    async (job) => {
      const { payload } = job
      const { instanceId } = payload
      const instance = await client.getInstance(instanceId)
      assertTruthy(instance, `Instance ${instanceId} not found`)
      assertTruthy(
        instance.uid === job.userId,
        `Instance ${instanceId} is not owned by user ${job.userId}`
      )
      const backup = await client.createBackup(instance.id)
      return { backupId: backup.id }
    }
  )
}
