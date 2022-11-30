<script lang="ts">
  import { client } from '$src/pocketbase'
  import { dbg, logger } from '$util/logger'
  import type { InstanceFields, WorkerLogFields } from '@pockethost/schema'
  import { createCleanupManager } from '@pockethost/tools'
  import { onDestroy, onMount } from 'svelte'
  import { writable } from 'svelte/store'

  export let instance: InstanceFields

  const { currentWorkerBundleId, id } = instance

  const logs = writable<WorkerLogFields[]>([])

  const cm = createCleanupManager({ logger })
  onMount(async () => {
    if (!currentWorkerBundleId) return
    dbg(`Watching instance log`)
    const unsub = client().watchInstanceLog(id, (newLogs) => {
      dbg(`Got new logs`, newLogs)
      logs.update((currentLogs) => {
        return [...currentLogs, ...newLogs].sort((a, b) => (a.created < b.created ? -1 : 1))
      })
    })
    cm.add(unsub)
  })

  onDestroy(cm.shutdown)
</script>

<h2>Logging</h2>
<p>Your Deno worker logs show up here.</p>
{#if !currentWorkerBundleId}
  <p>You have never uploaded a Deno worker. Use `pocketbase` CLI to do so.</p>
{/if}
{#if currentWorkerBundleId}
  <p>Current worker ID is {currentWorkerBundleId}.</p>
{/if}
