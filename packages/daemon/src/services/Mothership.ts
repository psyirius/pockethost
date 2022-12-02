import { spawnInstance } from '$util/spawnInstance'
import { binFor } from '@pockethost/releases'
import { AsyncReturnType } from 'type-fest'
import { ServicesConfig } from '.'
import { DAEMON_PB_PORT_BASE, PUBLIC_PB_SUBDOMAIN } from '../constants'

export type MothershipServiceConfig = {}

export type MothershipService = AsyncReturnType<typeof createMothershipService>

export const createMothershipService = async (
  config: MothershipServiceConfig
) => {
  /**
   * Launch central database
   */
  const mainProcess = await spawnInstance({
    subdomain: PUBLIC_PB_SUBDOMAIN,
    slug: PUBLIC_PB_SUBDOMAIN,
    port: DAEMON_PB_PORT_BASE,
    bin: binFor('lollipop'),
  })

  const shutdown = () => {
    mainProcess.kill()
  }
  return {
    shutdown,
  }
}

let _service: MothershipService | undefined
export const getMothershipService = async (config?: ServicesConfig) => {
  if (config) {
    _service?.shutdown()
    _service = await createMothershipService(config)
  }
  if (!_service) {
    throw new Error(`Attempt to use service before initialization`)
  }
  return _service
}
