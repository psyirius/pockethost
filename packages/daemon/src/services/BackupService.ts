import { BackupFields, BackupStatus } from '@pockethost/schema'
import { createTimerManager } from '@pockethost/tools'
import Bottleneck from 'bottleneck'
import { PocketbaseClientApi } from '../db/PbClient'
import { backupInstance } from '../util/backupInstance'
import { dbg } from '../util/logger'

export type BackupServiceConfig = {
  client: PocketbaseClientApi
}

export const createBackupService = async (config: BackupServiceConfig) => {
  const { client } = config

  const tm = createTimerManager({})
  const limiter = new Bottleneck({ maxConcurrent: 1 })
  tm.repeat(async () => {
    const backupRec = await client.getNextBackupJob()
    if (!backupRec) {
      // dbg(`No backups requested`)
      return true
    }
    const instance = await client.getInstance(backupRec.instanceId)
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

  const shutdown = () => {
    tm.shutdown()
  }
  return {
    shutdown,
  }
}
