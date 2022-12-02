import { services } from './services'
import { info } from './util/logger'
// npm install eventsource --save
global.EventSource = require('eventsource')
;(async () => {
  const unsub = await services({})

  process.once('SIGUSR2', async () => {
    info(`SIGUSR2 detected`)
    await unsub()
  })
})()
