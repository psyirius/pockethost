import { Command } from 'commander'
import { client } from '../util/client'
import { error, info } from '../util/logger'

export const addLoginCommand = (program: Command) => {
  program
    .command('login')
    .description('Log in to PocketHost')
    .argument('<email>', 'Email')
    .argument('<password>', 'Password')

    .action(async (email, password) => {
      const { authViaEmail } = client()
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
