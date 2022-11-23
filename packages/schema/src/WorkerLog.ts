import { BaseFields, RecordId } from './types'

export enum StreamNames {
  StdOut = 'stdio',
  StdErr = 'stderr',
}

export type WorkerLogFields = BaseFields & {
  bundleId: RecordId
  message: string
  stream: StreamNames
}

export type WorkerLogFields_Create = WorkerLogFields
