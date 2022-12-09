// @deno-types="https://cdn.jsdelivr.net/npm/pocketbase@^0.8.0/dist/pocketbase.es.d.ts"
import { EventSource as EventSourceClass } from 'https://cdn.jsdelivr.net/gh/MierenManz/EventSource@53f3ec9001d1eac19645c2214652a6a7aa3a51cb/mod.ts'
import Pocketbase from 'https://cdn.jsdelivr.net/npm/pocketbase@^0.8.0'
declare global {
  // deno-lint-ignore no-var
  var EventSource: typeof EventSourceClass
}

globalThis.EventSource = EventSourceClass

const POCKETBASE_URL = Deno.env.get('POCKETBASE_URL')
const ADMIN_LOGIN = Deno.env.get('ADMIN_LOGIN')
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD')

if (!POCKETBASE_URL) {
  throw new Error(`POCKETBASE_URL must be defined.`)
}

if (!ADMIN_LOGIN) {
  throw new Error(`ADMIN_LOGIN must be defined.`)
}

if (!ADMIN_PASSWORD) {
  throw new Error(`ADMIN_PASSWORD must be defined.`)
}

console.log(`Connecting to ${POCKETBASE_URL} with ${ADMIN_LOGIN}`)

const client = new Pocketbase(POCKETBASE_URL)

try {
  await client.admins.authWithPassword(ADMIN_LOGIN, ADMIN_PASSWORD)
  console.log(`Successfully logged in.`)
  client.collection('orders').subscribe('*', (data) => {
    console.log(`Got a data record`, data)
  })
} catch (e) {
  console.error(e, JSON.stringify(e))
}
