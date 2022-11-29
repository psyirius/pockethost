
import {
  SaveSecretsPayload,
  SaveSecretsPayloadSchema,
  SaveSecretsResult,
  RpcCommands,
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
      
      return { }
    }
  )
}
