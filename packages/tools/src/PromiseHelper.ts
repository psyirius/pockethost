import { serializeError } from 'serialize-error'
import { Logger } from './Logger'

export type PromiseHelperConfig = {
  logger: Logger
}

export type PromiseHelper = ReturnType<typeof createPromiseHelper>

export const createPromiseHelper = (config: PromiseHelperConfig) => {
  const { logger } = config
  const { dbg, error, warn } = logger

  let inside = ''
  let c = 0
  const safeCatch = <TIn extends any[], TOut>(
    name: string,
    cb: (...args: TIn) => Promise<TOut>
  ) => {
    return (...args: TIn) => {
      const _c = c++
      const uuid = `${name}:${_c}`
      const pfx = `[safeCatch:${uuid}]`
      // dbg(pfx, ...args)
      const tid = setTimeout(() => {
        dbg(pfx, `WARNING:`, `timeout waiting for ${pfx}`)
      }, 2000)

      inside = pfx
      return cb(...args)
        .then((res) => {
          // dbg(uuid, `finished`)
          inside = ''
          clearTimeout(tid)
          return res
        })
        .catch((e: any) => {
          dbg(pfx, serializeError(e))
          throw e
        })
    }
  }

  return { safeCatch }
}
