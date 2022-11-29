import { BaseFields, RpcCommands, UserId } from '@pockethost/schema'
import Ajv, { JSONSchemaType } from 'ajv'
import type pocketbaseEs from 'pocketbase'
import {
  ClientResponseError,
  RecordSubscription,
  UnsubscribeFunc,
} from 'pocketbase'
import type { JsonObject } from 'type-fest'
import { Logger } from '../Logger'
import { newId } from '../newId'
import { PromiseHelper } from '../PromiseHelper'
import type { WatchHelper } from './WatchHelper'

export type RpcHelperConfig = {
  client: pocketbaseEs
  watchHelper: WatchHelper
  promiseHelper: PromiseHelper
  logger: Logger
}

export type RpcHelper = ReturnType<typeof createRpcHelper>

export enum RpcStatus {
  New = 'new',
  Queued = 'queued',
  Running = 'running',
  Starting = 'starting',
  FinishedSuccess = 'finished-success',
  FinishedError = 'finished-error',
}

export type RpcPayloadBase = JsonObject

export type RpcRecord_Create<TRecord extends RpcFields<any, any>> = Pick<
  TRecord,
  'id' | 'userId' | 'payload' | 'cmd'
>

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

export const RPC_COLLECTION = `rpc`

export const createRpcHelper = (config: RpcHelperConfig) => {
  const {
    client,
    watchHelper: { watchById },
    promiseHelper: { safeCatch },
    logger: { dbg },
  } = config

  const mkRpc = <TPayload extends JsonObject, TResult extends JsonObject>(
    cmd: RpcCommands,
    schema: JSONSchemaType<TPayload>
  ) => {
    type ConcreteRpcRecord = RpcFields<TPayload, TResult>
    const validator = new Ajv().compile(schema)
    return safeCatch(
      cmd,
      async (
        payload: TPayload,
        cb?: (data: RecordSubscription<ConcreteRpcRecord>) => void
      ) => {
        const _user = client.authStore.model
        if (!_user) {
          throw new Error(`Expected authenticated user here.`)
        }
        if (!validator(payload)) {
          throw new Error(`Invalid RPC payload: ${validator.errors}`)
        }
        const { id: userId } = _user
        const rpcIn: RpcRecord_Create<ConcreteRpcRecord> = {
          id: newId(),
          cmd,
          userId,
          payload,
        }
        dbg({ rpcIn })
        let unsub: UnsubscribeFunc | undefined
        return new Promise<ConcreteRpcRecord['result']>(
          async (resolve, reject) => {
            try {
              dbg(`Watching ${rpcIn.id}`)
              unsub = await watchById<ConcreteRpcRecord>(
                RPC_COLLECTION,
                rpcIn.id,
                (data) => {
                  dbg(`Got an RPC change`, data)
                  cb?.(data)
                  if (data.record.status === RpcStatus.FinishedSuccess) {
                    resolve(data.record.result)
                    return
                  }
                  if (data.record.status === RpcStatus.FinishedError) {
                    reject(new ClientResponseError(data.record.result))
                    return
                  }
                },
                { initialFetch: false, pollIntervalMs: 100 }
              )
              dbg(`Creating ${rpcIn.id}`)
              const newRpc = await client
                .collection(RPC_COLLECTION)
                .create(rpcIn)
              dbg(`Created ${newRpc.id}`)
            } catch (e) {
              reject(e)
            }
          }
        ).finally(async () => {
          dbg(`Unwatching ${rpcIn.id}`)
          await unsub?.()
        })
      }
    )
  }

  return { mkRpc }
}
