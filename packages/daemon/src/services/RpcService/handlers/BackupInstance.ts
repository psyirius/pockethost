import { BackupInstancePayload, BackupInstanceResult } from '@pockethost/schema'
import { assertTruthy } from '@pockethost/tools'
import { RpcRunnerFactory } from '..'

const register: RpcRunnerFactory<BackupInstancePayload, BackupInstanceResult> =
  ({ client }) =>
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

export default register
