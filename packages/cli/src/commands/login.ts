import { Command } from 'commander'
import { client } from '../util/client'
import { dbg, error, info } from '../util/logger'
import { setProject } from '../util/project'

export const addLoginCommand = (program: Command) => {
  program
    .command('login')
    .description('Log in to PocketHost')
    .argument('<email>', 'Email')
    .argument('<password>', 'Password')
    .option(
      '-h|--host <endpoint>',
      'PocketHost endpoint',
      'pockethost-central.pockethost.io'
    )
    .action(async (email, password, options) => {
      dbg(`Options`, options)
      const { host } = options
      setProject((project) => {
        project.host = host
      })
      const { authViaEmail } = client(host)
      try {
        await authViaEmail(email, password)
        info(`You are now logged in.`)
      } catch (e: unknown) {
        if (!(e instanceof Error)) {
          throw new Error(`Expected Error here, but got ${typeof e}: ${e}`)
        }
        error(`Login failed`)
        error(e)
        process.exit()
      }
    })
}
