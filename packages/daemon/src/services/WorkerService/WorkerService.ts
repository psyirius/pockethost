import { PocketbaseClientApi } from '../../db/PbClient'
import { RpcServiceApi } from '../RpcService'

export type WorkerServiceConfig = {
  client: PocketbaseClientApi
  rpcService: RpcServiceApi
}
export const createWorkerService = async (config: WorkerServiceConfig) => {
  const { rpcService, client } = config

  const shutdown = () => {}
  return {
    shutdown,
  }
}
