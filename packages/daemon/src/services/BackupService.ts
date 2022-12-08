import { BackupFields, BackupStatus } from '@pockethost/schema'
import { createTimerManager } from '@pockethost/tools'
import Bottleneck from 'bottleneck'
import { AsyncReturnType } from 'type-fest'
import { DaemonService, ServicesConfig } from '.'
import { backupInstance } from '../util/backupInstance'
import { dbg } from '../util/logger'
import { getClientService } from './ClientService'

export type BackupServiceConfig = {}

export type BackupService = AsyncReturnType<typeof createBackupService>

export const createBackupService = async (
  config: BackupServiceConfig
): Promise<DaemonService> => {
  const client = await getClientService()

  const tm = createTimerManager({})
  const limiter = new Bottleneck({ maxConcurrent: 1 })
  tm.repeat(async () => {
    const backupRec = await client.getNextBackupJob()
    if (!backupRec) {
      // dbg(`No backups requested`)
      return true
    }
    const [instance] = await client.getInstanceById(backupRec.instanceId)
    if (!instance) {
      throw new Error(
        `Instance in backup record does not exist ${backupRec.instanceId}`
      )
    }
    const _update = (fields: Partial<BackupFields>) =>
      limiter.schedule(() => client.updateBackup(backupRec.id, fields))
    try {
      await _update({
        status: BackupStatus.Running,
      })
      let progress = backupRec.progress || {}
      const bytes = await backupInstance(
        instance.id,
        backupRec.id,
        (_progress) => {
          progress = { ...progress, ..._progress }
          dbg(_progress)
          return _update({
            progress,
          })
        }
      )
      await _update({
        bytes,
        status: BackupStatus.FinishedSuccess,
      })
    } catch (e) {
      const message = (() => {
        const s = `${e}`
        if (s.match(/ENOENT/)) {
          return `Backup failed because instance has never been used. Go to the instance admin to use the instance for the first time.`
        }
        return s
      })()
      await _update({
        status: BackupStatus.FinishedError,
        message,
      })
    }
    return true
  }, 1000)

  const shutdown = async () => {
    await limiter.stop()
    tm.shutdown()
  }
  return {
    shutdown,
  }
}

let _service: BackupService | undefined
export const getBackupService = async (config?: ServicesConfig) => {
  if (config) {
    _service?.shutdown()
    _service = await createBackupService(config)
    dbg(`Backup service initialized`)
  }
  if (!_service) {
    throw new Error(`Attempt to use backup service before initialization`)
  }
  return _service
}
