#!/usr/bin/env tsx
import { program } from 'commander'

declare global {
  let __go_app: any
}

import 'cross-fetch/polyfill'
import pkg from '../package.json'
import { addDevCommand } from './commands/dev'
import { addInitCommand } from './commands/init'
import { addLoginCommand } from './commands/login'
import { addPublishCommand } from './commands/publish'
import { addTailCommand } from './commands/tail'
import { dbg } from './util/logger'
console.log(`PocketHost CLI ${pkg.version}`)
global.EventSource = require('eventsource')
dbg(`EventSource registered`)

program
  .name('pockethost')
  .description('https://pockethost.io CLI')
  .version('0.0.1')
addLoginCommand(program)
addInitCommand(program)
addDevCommand(program)
addPublishCommand(program)
addTailCommand(program)

program.parse()
