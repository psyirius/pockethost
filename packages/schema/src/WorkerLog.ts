import { BaseFields, RecordId } from './types'

export enum StreamNames {
  Info = 'info',
  Warning = 'warning',
  Debug = 'debug',
  Error = 'error',
  System = 'system',
}

export type WorkerLogFields = BaseFields & {
  bundleId: RecordId
  message: string
  stream: StreamNames
}

export type WorkerLogFields_Create = WorkerLogFields
