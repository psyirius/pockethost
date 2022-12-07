import { getClientService } from '$services/ClientService'
import {
  RpcCommands,
  SaveSecretsPayload,
  SaveSecretsPayloadSchema,
  SaveSecretsResult,
} from '@pockethost/schema'
import { getRpcService, RpcHandlerFactory } from '..'

export const registerSaveSecretsHandler: RpcHandlerFactory = async () => {
  const client = await getClientService()
  const rpcService = await getRpcService()
  const { registerCommand } = rpcService
  registerCommand<SaveSecretsPayload, SaveSecretsResult>(
    RpcCommands.SaveSecrets,
    SaveSecretsPayloadSchema,
    async (job) => {
      const { payload } = job
      const { instanceId, secrets } = payload
      await client.updateInstance(instanceId, { secrets })
      return { status: 'saved' }
    }
  )
}
