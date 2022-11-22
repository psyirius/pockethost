import { createLogger } from '@pockethost/common'

export const logger = createLogger({ debug: true })

export const { dbg, info, warn, error } = logger
