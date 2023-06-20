import {
  createTimerManager,
  mkSingleton,
  SingletonBaseConfig,
  StatsFields,
  STATS_COLLECTION,
  STATS_VIEW_COLLECTION,
} from '@pockethost/common'
import { omit } from '@s-libs/micro-dash'
import { clientService } from './clientService/clientService'

export type StatsServiceConfig = SingletonBaseConfig & {}

export const statsService = mkSingleton(async (config: StatsServiceConfig) => {
  const { logger } = config
  const _serviceLogger = logger.create('StatsService')
  const { dbg, error, warn, abort } = _serviceLogger

  dbg(`Initializing stats`)
  const tm = createTimerManager({ logger: _serviceLogger })
  const { client } = (await clientService()).client

  tm.repeat(async () => {
    dbg(`Calculating stats`)
    try {
      const stats = await client
        .collection(STATS_VIEW_COLLECTION)
        .getList<StatsFields>(1, 1)
      dbg(`stats`, stats)
      await client
        .collection(STATS_COLLECTION)
        .create<StatsFields>(omit(stats.items[0], 'id'))
    } catch (e) {
      error(`Error calculating stats with`, JSON.stringify(e, null, 2))
    }

    return true
  }, 1000)

  return {
    shutdown: async () => {},
  }
})
