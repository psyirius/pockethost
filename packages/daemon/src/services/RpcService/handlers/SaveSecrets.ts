import {
  RpcCommands,
  SaveSecretsPayload,
  SaveSecretsPayloadSchema,
  SaveSecretsResult,
} from '@pockethost/schema'
import { RpcHandlerFactory } from '..'

export const registerSaveSecretsHandler: RpcHandlerFactory = ({
  client,
  rpcService: { registerCommand },
}) => {
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
