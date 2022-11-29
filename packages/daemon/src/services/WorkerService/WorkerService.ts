import { PocketbaseClientApi } from '../../db/PbClient'

export type WorkerServiceConfig = {
  client: PocketbaseClientApi
}
export const createWorkerService = async (config: WorkerServiceConfig) => {
  const { client } = config

  const shutdown = () => {}
  return {
    shutdown,
  }
}
