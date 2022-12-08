import { getClientService } from '$services/ClientService'
import {
  BackupInstancePayload,
  BackupInstancePayloadSchema,
  BackupInstanceResult,
  RpcCommands,
} from '@pockethost/schema'
import { assertTruthy } from '@pockethost/tools'
import { getRpcService, RpcHandlerFactory } from '..'

export const registerBackupInstanceHandler: RpcHandlerFactory = async () => {
  const client = await getClientService()
  const rpcService = await getRpcService()
  const { registerCommand } = rpcService

  registerCommand<BackupInstancePayload, BackupInstanceResult>(
    RpcCommands.BackupInstance,
    BackupInstancePayloadSchema,
    async (job) => {
      const { payload } = job
      const { instanceId } = payload
      const [instance] = await client.getInstanceById(instanceId)
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
