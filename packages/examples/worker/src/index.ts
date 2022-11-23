// @deno-types="https://cdn.jsdelivr.net/npm/pocketbase@^0.8.0/dist/pocketbase.es.d.ts"
import Pocketbase from 'https://cdn.jsdelivr.net/npm/pocketbase@^0.8.0'

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

await client.admins
  .authWithPassword(ADMIN_LOGIN, ADMIN_PASSWORD)
  .catch((e: Error) => console.log(e, JSON.stringify(e)))

console.log(`Successfully logged in.`)
console.log(client.authStore)
