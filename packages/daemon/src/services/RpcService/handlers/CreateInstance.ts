import { LATEST_PLATFORM, USE_LATEST_VERSION } from '@pockethost/releases'
import {
  CreateInstancePayload,
  CreateInstancePayloadSchema,
  CreateInstanceResult,
  InstanceStatus,
  RpcCommands,
} from '@pockethost/schema'
import { RpcHandlerFactory } from '..'

export const registerCreateInstanceHandler: RpcHandlerFactory = ({
  client,
  rpcService: { registerCommand },
}) => {
  registerCommand<CreateInstancePayload, CreateInstanceResult>(
    RpcCommands.CreateInstance,
    CreateInstancePayloadSchema,
    async (rpc) => {
      const { payload } = rpc
      const { subdomain } = payload
      const instance = await client.createInstance({
        subdomain,
        uid: rpc.userId,
        version: USE_LATEST_VERSION,
        status: InstanceStatus.Idle,
        platform: LATEST_PLATFORM,
        secondsThisMonth: 0,
        isBackupAllowed: false,
        currentWorkerBundleId: '',
        secrets: {},
      })
      return { instance }
    }
  )
}
