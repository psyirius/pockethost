import { getClientService } from '$services/ClientService'
import { RpcCommands, RpcFields, RpcStatus } from '@pockethost/schema'
import { assertTruthy } from '@pockethost/tools'
import { isObject, keys } from '@s-libs/micro-dash'
import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv'
import Bottleneck from 'bottleneck'
import { default as knexFactory } from 'knex'
import pocketbaseEs from 'pocketbase'
import { AsyncReturnType, JsonObject } from 'type-fest'
import { ServicesConfig } from '..'
import { dbg, error } from '../../util/logger'
import { registerBackupInstanceHandler } from './handlers/BackupInstance'
import { registerCreateInstanceHandler } from './handlers/CreateInstance'
import { registerPublishBundleHandler } from './handlers/PublishBundle'
import { registerSaveSecretsHandler } from './handlers/SaveSecrets'
// gen:import

export type RpcServiceApi = AsyncReturnType<typeof createRpcService>

export type KnexApi = ReturnType<typeof knexFactory>
export type CommandModuleInitializer = (
  register: RpcServiceApi['registerCommand'],
  client: pocketbaseEs,
  knex: KnexApi
) => void

export type RpcRunner<
  TPayload extends JsonObject,
  TResult extends JsonObject
> = (job: RpcFields<TPayload, TResult>) => Promise<TResult>

export type RpcHandlerFactory = (config?: {}) => Promise<void>

export type RpcServiceConfig = {}

export const createRpcService = async (config: RpcServiceConfig) => {
  const client = await getClientService()

  const limiter = new Bottleneck({ maxConcurrent: 1 })

  const jobHandlers: {
    [_ in RpcCommands]?: {
      validate: ValidateFunction<any>
      run: RpcRunner<any, any>
    }
  } = {}

  const run = async (rpc: RpcFields<any, any>) => {
    await client.setRpcStatus(rpc, RpcStatus.Queued)
    return limiter.schedule(async () => {
      try {
        dbg(`Starting job ${rpc.id} (${rpc.cmd})`, JSON.stringify(rpc))
        await client.setRpcStatus(rpc, RpcStatus.Starting)
        const cmd = (() => {
          const { cmd } = rpc
          if (!jobHandlers[cmd as RpcCommands]) {
            throw new Error(
              `RPC command '${cmd}' is invalid. It must be one of: ${keys(
                jobHandlers
              ).join('|')}.`
            )
          }
          return cmd as RpcCommands
        })()

        const handler = jobHandlers[cmd]
        if (!handler) {
          throw new Error(`RPC handler ${cmd} is not registered`)
        }

        const { payload } = rpc
        assertTruthy(isObject(payload), `Payload must be an object`)

        const { validate, run } = handler
        if (!validate(payload)) {
          throw new Error(
            `Payload for ${cmd} fails validation: ${JSON.stringify(payload)}`
          )
        }
        dbg(`Running RPC ${rpc.id}`, rpc)
        await client.setRpcStatus(rpc, RpcStatus.Running)
        const res = await run(rpc)
        await client.setRpcStatus(rpc, RpcStatus.FinishedSuccess, res)
      } catch (e) {
        error(`Job failed with`, e)
        if (!(e instanceof Error)) {
          throw new Error(`Expected Error here but got ${typeof e}:${e}`)
        }
        await client.rejectRpc(rpc, e).catch((e) => {
          error(`rpc ${rpc.id} failed to reject with ${e}`)
        })
      }
    })
  }

  const unsub = await client.onNewRpc(run)
  await client.resetRpcs()
  await client.resetBackups()
  const rpcs = await client.incompleteRpcs()
  rpcs.forEach(run)

  const shutdown = () => {
    unsub()
  }

  const ajv = new Ajv()

  const registerCommand = <
    TPayload extends JsonObject,
    TResult extends JsonObject
  >(
    commandName: RpcCommands,
    schema: JSONSchemaType<TPayload>,
    runner: RpcRunner<TPayload, TResult>
  ) => {
    if (jobHandlers[commandName]) {
      throw new Error(`${commandName} job handler already registered.`)
    }
    jobHandlers[commandName] = {
      validate: ajv.compile(schema),
      run: runner,
    }
  }

  const api = {
    registerCommand,
    shutdown,
  }
  _service = api

  await registerBackupInstanceHandler()
  await registerCreateInstanceHandler()
  await registerPublishBundleHandler()
  // registerRestoreInstanceHandler({ client, rpcService })
  await registerSaveSecretsHandler()
  // gen:handler

  return api
}

let _service: RpcServiceApi | undefined
export const getRpcService = async (config?: ServicesConfig) => {
  if (config) {
    _service?.shutdown()
    _service = await createRpcService(config)
  }
  if (!_service) {
    throw new Error(`Attempt to use Rpc service before initialization`)
  }
  return _service
}
