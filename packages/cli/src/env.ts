import { createEnv } from '@pockethost/tools'
import { nodeEnvResolver } from '@pockethost/tools/src/nodeEnvResolver'

const { envb, envs } = createEnv(nodeEnvResolver)

export const PH_DEBUG = envb('PH_DEBUG', false)
export const PH_MOTHERSHIP = envs('PH_MOTHERSHIP', 'pockethost-central')
export const PH_HOST = envs('PH_HOST', 'pockethost.io')
export const PH_ENTRY_PATH = envs('PH_ENTRY_PATH', './src/index.ts')
export const PH_CONFIG_FNAME = envs(`PH_CONFIG_FNAME`, `pockethost.json`)
export const PH_CACHE_FNAME = envs(`PH_CACHE_FNAME`, '.pockethost')
