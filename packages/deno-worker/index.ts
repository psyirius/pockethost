// @deno-types="https://cdn.jsdelivr.net/npm/pocketbase@^0.8.0/dist/pocketbase.es.d.ts"
import { EventSource as EventSourceClass } from 'https://cdn.jsdelivr.net/gh/MierenManz/EventSource@53f3ec9001d1eac19645c2214652a6a7aa3a51cb/mod.ts'
import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase@^0.8.0'
declare global {
  // deno-lint-ignore no-var
  var EventSource: typeof EventSourceClass
}

globalThis.EventSource = EventSourceClass

export { PocketBase }
