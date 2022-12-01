import { createRealtimeLogMiddleware } from '$services/ProxyService/middleware/Mothership/middleware/RealtimeLog'
import { binFor } from '@pockethost/releases'
import {
  DAEMON_PB_PASSWORD,
  DAEMON_PB_PORT_BASE,
  DAEMON_PB_USERNAME,
  PUBLIC_PB_DOMAIN,
  PUBLIC_PB_PROTOCOL,
  PUBLIC_PB_SUBDOMAIN,
} from './constants'
import { createPbClient } from './db/PbClient'
import { createBackupService } from './services/BackupService'
import { createInstanceService } from './services/InstanceService/InstanceService'
import { createDockerHealthCheckMiddleware } from './services/ProxyService/middleware/DockerHealthCheck'
import { createMothershipMiddleware } from './services/ProxyService/middleware/Mothership/Mothership'
import { createProxyService } from './services/ProxyService/ProxyService'
import { createRpcService } from './services/RpcService'
import { createSqliteService } from './services/SqliteService/SqliteService'
import { mkInternalUrl } from './util/internal'
import { dbg, error, info } from './util/logger'
import { spawnInstance } from './util/spawnInstance'
// npm install eventsource --save
global.EventSource = require('eventsource')
;(async () => {
  const coreInternalUrl = mkInternalUrl(DAEMON_PB_PORT_BASE)

  /**
   * Launch central database
   */
  const mainProcess = await spawnInstance({
    subdomain: PUBLIC_PB_SUBDOMAIN,
    slug: PUBLIC_PB_SUBDOMAIN,
    port: DAEMON_PB_PORT_BASE,
    bin: binFor('lollipop'),
  })

  /**
   * Launch services
   */
  const client = createPbClient(coreInternalUrl)
  try {
    await client.adminAuthViaEmail(DAEMON_PB_USERNAME, DAEMON_PB_PASSWORD)
    dbg(`Logged in`)
  } catch (e) {
    error(
      `***WARNING*** CANNOT AUTHENTICATE TO ${PUBLIC_PB_PROTOCOL}://${PUBLIC_PB_SUBDOMAIN}.${PUBLIC_PB_DOMAIN}/_/`
    )
    error(`***WARNING*** LOG IN MANUALLY, ADJUST .env, AND RESTART DOCKER`)
  }

  const sqliteService = await createSqliteService({})

  /**
   * Top level proxy and all middleware
   */
  const proxyService = await createProxyService({})
  const dockerHealthMiddleware = await createDockerHealthCheckMiddleware({
    proxyService,
  })
  const mothershipMiddleware = await createMothershipMiddleware({
    proxyService,
  })

  const realtimeLogMiddleware = await createRealtimeLogMiddleware({
    mothershipMiddleware,
    sqliteService,
  })

  const rpcService = await createRpcService({ client })
  const instanceService = await createInstanceService({ client, rpcService })
  const backupService = await createBackupService({ client })

  process.once('SIGUSR2', async () => {
    info(`SIGUSR2 detected`)
    await Promise.all([
      sqliteService.shutdown(),
      instanceService.shutdown(),
      proxyService.shutdown(),
      rpcService.shutdown(),
      backupService.shutdown(),
      mainProcess.kill(),
      dockerHealthMiddleware.shutdown(),
      realtimeLogMiddleware.shutdown(),
      mothershipMiddleware.shutdown(),
    ])
  })
})()
