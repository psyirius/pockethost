import { map } from '@s-libs/micro-dash'
import { Logger } from './Logger'

export type CleanupFunc = () => any | Promise<any>

export type CleanupManagerConfig = {
  logger: Logger
}
export const createCleanupManager = (config: CleanupManagerConfig) => {
  const { logger } = config
  const { dbg } = logger
  let i = 0
  const cleanups: any = {}
  const add = (cb: CleanupFunc) => {
    const idx = i++
    const cleanup = () => {
      cb()
      delete cleanups[idx]
    }
    cleanups[idx] = cleanup
    return cleanup
  }

  const shutdown = async () => {
    await Promise.all<any>(map(cleanups, (c) => c()))
  }

  return { add, shutdown }
}
