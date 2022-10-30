/** @type {import('@sveltejs/kit').Handle} */

import type { Handle } from '@sveltejs/kit'
import { PUBLIC_PB_DOMAIN, PUBLIC_PB_SUBDOMAIN } from './env'
import { client } from './pocketbase'

export const handle: Handle = async ({ event, resolve }) => {
  console.log(`handle for`, event)
  const host = `${PUBLIC_PB_SUBDOMAIN}.${PUBLIC_PB_DOMAIN}`
  client({
    url: `http://daemon:3000`,
    cookie: event.request.headers.get('cookie'),
    beforeSend: (url, reqConfig) => {
      console.log('before send', { url, reqConfig, host })
      reqConfig.headers = { ...reqConfig.headers, host }
      return reqConfig
    }
  })

  const response = await resolve(event)

  return response
}
