import { getClientService } from '$services/ClientService'
import { getInstanceService } from '$services/InstanceService/InstanceService'
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

      const instanceService = await getInstanceService()
      const instance = await instanceService.getInstanceById(instanceId)
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found.`)
      }
      instance.reloadDeno()
      return { status: 'saved' }
    }
  )
}
