import { BaseFields, RecordId } from './types'

export const STATS_COLLECTION = 'stats'
export const STATS_VIEW_COLLECTION = 'statsView'

export type StatsId = string

export type StatsCollection = {
  [name: StatsId]: StatsFields
}

export const STATS_FIELD_NAMES = [
  'daysUp',
  'userCount',
  'instanceCount',
  'runningInstanceCount',
  'instanceCount1Hour',
  'instanceCount1Day',
  'instanceCount7Day',
  'instanceCount30Day',
  'invocationCount',
  'invocationCount1Hour',
  'invocationCount1Day',
  'invocationCount7Day',
  'invocationCount30Day',
  'invocationSeconds',
  'invocationSeconds1Hour',
  'invocationSeconds1Day',
  'invocationSeconds7Day',
  'invocationSeconds30Day',
]

export type StatsFields = BaseFields & {
  daysUp: number
  userCount: number
  instanceCount: number
  runningInstanceCount: number
  instanceCount1Hour: number
  instanceCount1Day: number
  instanceCount7Day: number
  instanceCount30Day: number
  invocationCount: number
  invocationCount1Hour: number
  invocationCount1Day: number
  invocationCount7Day: number
  invocationCount30Day: number
  invocationSeconds: number
  invocationSeconds1Hour: number
  invocationSeconds1Day: number
  invocationSeconds7Day: number
  invocationSeconds30Day: number
}

export type StatsFields_Create = Omit<StatsFields, keyof BaseFields>

export type StatsById = { [_: RecordId]: StatsFields }
