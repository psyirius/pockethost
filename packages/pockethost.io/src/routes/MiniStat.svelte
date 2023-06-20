<script lang="ts">
  import { client } from '$src/pocketbase'
  import {
    STATS_COLLECTION,
    createCleanupManager,
    logger,
    type StatsFields
  } from '@pockethost/common'
  import { forEach } from '@s-libs/micro-dash'
  import { onDestroy, onMount } from 'svelte'
  import { writable } from 'svelte/store'

  const { dbg, error } = logger().create(`MiniStat.svelte`)

  type StatsCollection = {
    [_: string]: {
      unit: String
      data: number[]
      fieldName: keyof StatsFields
      calc: (v: number) => number
    }
  }
  const stats = writable<StatsCollection>({
    Uptime: {
      fieldName: 'daysUp',
      unit: 'days',
      data: [],
      calc: (v) => Math.ceil(v)
    },
    ['Live Instances']: {
      fieldName: 'runningInstanceCount',
      unit: '',
      data: [],
      calc: (v) => v
    }
  })

  const cm = createCleanupManager()
  onMount(() => {
    const _update = (items: StatsFields[]) => {
      stats.update((old) => {
        forEach(old, (oldItem, k) => {
          const { fieldName, calc } = oldItem
          forEach(items, (incomingItem) => {
            dbg({ incomingItem })
            if (old[k].data.length > 10) {
              old[k].data.pop()
            }
            const newValue = incomingItem[fieldName] as number
            const calcedValue = calc(newValue)
            old[k].data.push(calcedValue)
          })
        })
        dbg({ old })
        return old
      })
    }
    client()
      .client.collection(STATS_COLLECTION)
      .getList<StatsFields>(1, 10, { sort: `-created` })
      .then((data) => {
        _update(data.items)
      })
      .catch(error)
    client()
      .client.collection(STATS_COLLECTION)
      .subscribe<StatsFields>('*', (data) => {
        dbg(`got an update`, data)
        _update([data.record])
      })
      .then(cm.add)
      .catch(error)
  })

  onDestroy(() => {
    cm.shutdown()
  })
</script>

<div>
  {#each Object.entries($stats) as [k, stat]}
    <div>
      {k}: {stat.data[stat.data.length - 1]}
      {stat.unit}
    </div>
  {/each}
</div>
