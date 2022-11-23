import { createPromiseHelper } from '@pockethost/tools'
import { logger } from './logger'

export const promiseHelper = createPromiseHelper({ logger })
export const { safeCatch } = promiseHelper
