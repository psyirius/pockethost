import { JsonObject } from 'type-fest'
import { BaseFields, UserId } from '../types'

export const RPC_COLLECTION = 'rpc'
export enum RpcCommands {
  CreateInstance = 'create-instance',
  BackupInstance = 'backup-instance',
  RestoreInstance = 'restore-instance',
  PublishBundle = 'publish-bundle',
  // gen:enum
}

export const RPC_COMMANDS = [
  RpcCommands.BackupInstance,
  RpcCommands.CreateInstance,
  RpcCommands.PublishBundle,
  // gen:array
]

export enum RpcStatus {
  New = 'new',
  Queued = 'queued',
  Running = 'running',
  Starting = 'starting',
  FinishedSuccess = 'finished-success',
  FinishedError = 'finished-error',
}

export type RpcPayloadBase = JsonObject

export type RpcFields<
  TPayload extends RpcPayloadBase,
  TRes extends JsonObject
> = BaseFields & {
  userId: UserId
  cmd: string
  payload: TPayload
  status: RpcStatus
  message: string
  result: TRes
}

export type RpcRecord_Create<TRecord extends RpcFields<any, any>> = Pick<
  TRecord,
  'id' | 'userId' | 'payload' | 'cmd'
>

export * from './BackupInstance'
export * from './CreateInstance'
export * from './PublishBundle'
export * from './RestoreInstance'
// gen:export
