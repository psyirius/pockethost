import { PocketbaseClientApi } from '$src/db/PbClient'
import { getBackupService } from './BackupService'
import { getInstanceService } from './InstanceService/InstanceService'
import { getProxyService } from './ProxyService/ProxyService'
import { getRpcService } from './RpcService'
import { getSqliteService } from './SqliteService/SqliteService'

export type ServiceApiBase<TPublicApi> = {
  public: TPublicApi
  shutdown: () => Promise<void>
}

export type ServicesConfig = {
  client: PocketbaseClientApi
}

export const services = async (config: ServicesConfig) => {
  getBackupService(config)
  getSqliteService(config)
  getRpcService(config)
  getInstanceService(config)
  getProxyService(config)
}
