import { createLogger } from '@pockethost/tools'
import { DEBUG } from '../constants'

export const logger = createLogger({ debug: DEBUG })
export const { dbg, info, warn, error } = logger
