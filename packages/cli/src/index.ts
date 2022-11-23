#!/usr/bin/env tsx
import { program } from 'commander'

declare global {
  let __go_app: any
}

import 'cross-fetch/polyfill'
import 'eventsource'
import pkg from '../package.json'
import { addDevCommand } from './commands/dev'
import { addInitCommand } from './commands/init'
import { addLoginCommand } from './commands/login'
console.log(`PocketHost CLI ${pkg.version}`)

program
  .name('pockethost')
  .description('https://pockethost.io CLI')
  .version('0.0.1')
addLoginCommand(program)
addInitCommand(program)
addDevCommand(program)

program.parse()
