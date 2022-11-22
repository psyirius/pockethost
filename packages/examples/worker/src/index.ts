// @deno-types="https://cdn.jsdelivr.net/npm/pocketbase@^0.8.0/dist/pocketbase.es.d.ts"
import Pocketbase from 'https://cdn.jsdelivr.net/npm/pocketbase@^0.8.0'

const POCKETBASE_URL = Deno.env.get('POCKETBASE_URL')

console.log({ POCKETBASE_URL })

const client = new Pocketbase(POCKETBASE_URL)

await client.admins
  .authWithPassword(`admin@pockethost.io`, `53JBp9Y9tns9vRx`)
  .catch((e: Error) => console.log(e, JSON.stringify(e)))

const instances = await client.collection('instances').getFullList(100)

console.log({ instances })
