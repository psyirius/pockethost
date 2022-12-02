import { Unsubscribe } from '@pockethost/tools'
import { UnsubscribeFunc } from 'pocketbase'
import { getBackupService } from './BackupService'
import { getClientService } from './ClientService'
import { getMothershipService } from './Mothership'
import { dockerHealthCheck } from './ProxyService/middleware/DockerHealthCheck'
import { instance } from './ProxyService/middleware/Instance'
import { realtimeLog } from './ProxyService/middleware/Mothership/middleware/RealtimeLog'
import { mothership } from './ProxyService/middleware/Mothership/Mothership'
import { getProxyService } from './ProxyService/ProxyService'
import { getRpcService } from './RpcService'
import { getSqliteService } from './SqliteService/SqliteService'

export type DaemonService = { shutdown: () => Promise<void> }

export type ServicesConfig = {}

export const services = async (config: ServicesConfig) => {
  const shutdowns: (UnsubscribeFunc | Unsubscribe)[] = []

  /**
   * SqliteService provides raw SQLite access to .db files.
   * It maintains a singleton connection to each database
   * so watch events can happen.
   */
  {
    const ss = await getSqliteService({})
    shutdowns.unshift(ss.shutdown)
  }

  /**
   * Launch the main PocketBase instance and
   * initialize the client by logging in as an admin.
   *
   * Most other services are dependent on an active
   * client connection to the mothership.
   */
  {
    const ms = await getMothershipService({})
    const client = await getClientService({})
    shutdowns.unshift(ms.shutdown)
    shutdowns.unshift(client.shutdown)
  }

  /**
   * The Backup and Rpc services both listen for database
   * changes to the `rpcs` and `backups` tables. We have
   * found that this is an efficient way to model an
   * observer pattern for dispatching daemon events.
   */
  {
    const rs = await getRpcService(config)
    const bs = await getBackupService(config)
    shutdowns.unshift(bs.shutdown)
    shutdowns.unshift(rs.shutdown)
  }

  /**
   * Finally, create the Proxy service. This is the main
   * entry point to the daemon. It handles incoming requests
   * and routes them to the appropriate PB instance, Deno
   * instance, or to the mothership.
   */
  {
    // Initialize the mothership and all dependent handlers
    const ms = await mothership()
    const rtl = await realtimeLog()
    ms.use(rtl.handle)

    // Docker Health Check middleware
    const dhc = await dockerHealthCheck()

    // Instance routing/dispatching middleware
    const i = await instance()

    // And the proxy service itself
    const ps = await getProxyService(config)
    ps.use(ms.handle)
    ps.use(dhc.handle)
    ps.use(i.handle)
  }

  return async () => {
    for (let i = 0; i < shutdowns.length; i++) {
      await shutdowns[i]
    }
  }
}
