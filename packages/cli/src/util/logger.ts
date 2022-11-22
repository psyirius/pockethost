import { createLogger } from '@pockethost/tools'
import { PH_DEBUG } from '../env'

export const logger = createLogger({ debug: PH_DEBUG })

export const { dbg, info, warn, error } = logger
