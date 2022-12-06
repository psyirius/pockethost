<script lang="ts">
  import { client } from '$src/pocketbase'
  import { dbg, logger } from '$util/logger'
  import type { InstanceFields, RecordId, WorkerLogFields } from '@pockethost/schema'
  import { createCleanupManager } from '@pockethost/tools'
  import { values } from '@s-libs/micro-dash'
  import { onDestroy, onMount } from 'svelte'
  import { writable } from 'svelte/store'

  export let instance: InstanceFields

  const { currentWorkerBundleId, id } = instance

  const logs = writable<{ [_: RecordId]: WorkerLogFields }>({})

  const cm = createCleanupManager({ logger })
  onMount(async () => {
    if (!currentWorkerBundleId) return
    dbg(`Watching instance log`)
    const unsub = client().watchInstanceLog(id, (newLog) => {
      dbg(`Got new log`, newLog)
      logs.update((currentLogs) => {
        return { ...currentLogs, [newLog.id]: newLog }
      })
    })
    cm.add(unsub)
  })

  onDestroy(cm.shutdown)
</script>

<h2>Logging</h2>
{#if !currentWorkerBundleId}
  <p>Your Deno worker logs show up here.</p>
  <p>You have never uploaded a Deno worker. Use `pocketbase` CLI to do so.</p>
{/if}
{#if currentWorkerBundleId}
  {#each values($logs)
    .sort((a, b) => (a.created < b.created ? 1 : -1))
    .slice(0, 10) as log}
    <div class="log">
      <div class="time">{log.created}</div>

      <div class="stream">{log.stream}</div>
      <div class="message">
        {(() => {
          try {
            const parsed = JSON.parse(log.message)
            return `<code>${parsed}</code>`
          } catch (e) {
            return log.message
          }
        })()}
      </div>
    </div>
  {/each}
  <p>Current worker ID is {currentWorkerBundleId}.</p>
{/if}

<style lang="scss">
  .log {
    position: relative;
    .time {
      position: absolute;
      left: 3px;
      top: 3px;
      color: gray;
    }
    .stream {
      position: absolute;
      right: 3px;
      top: 3px;
      color: gray;
    }
    .message {
      padding-top: 25px;
      padding-bottom: 5px;
      overflow: hidden;
    }
    border-top: 1px solid rgb(100, 100, 100);
  }
</style>
