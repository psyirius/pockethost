import { mkInternalUrl } from '$util/internal'
import { dbg, error } from '$util/logger'
import { AsyncReturnType } from 'type-fest'
import { ServicesConfig } from '.'
import {
  DAEMON_PB_PASSWORD,
  DAEMON_PB_PORT_BASE,
  DAEMON_PB_USERNAME,
  PUBLIC_PB_DOMAIN,
  PUBLIC_PB_PROTOCOL,
  PUBLIC_PB_SUBDOMAIN,
} from '../constants'
import { createPbClient } from '../db/PbClient'

export type ClientServiceConfig = {}

export type ClientService = AsyncReturnType<typeof createClientService>

export const createClientService = async (config: ClientServiceConfig) => {
  /**
   * Launch services
   */
  const coreInternalUrl = mkInternalUrl(DAEMON_PB_PORT_BASE)

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

  const shutdown = () => {}
  return {
    ...client,
    shutdown,
  }
}

let _service: ClientService | undefined
export const getClientService = async (config?: ServicesConfig) => {
  if (config) {
    _service?.shutdown()
    _service = await createClientService({ ...config })
  }
  if (!_service) {
    throw new Error(`Attempt to use backup service before initialization`)
  }
  return _service
}
