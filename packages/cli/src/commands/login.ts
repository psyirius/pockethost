import { Command } from 'commander'
import { PH_HOST } from '../env'
import { client } from '../util/client'

export const addLoginCommand = (program: Command) => {
  program
    .command('login')
    .description(`Log in to ${PH_HOST}`)
    .argument('<email>', 'Email')
    .argument('<password>', 'Password')

    .action(async (email, password) => {
      const { authViaEmail } = client()
      try {
        await authViaEmail(email, password)
        console.log(`You are now logged in.`)
      } catch (e: unknown) {
        if (!(e instanceof Error)) {
          throw new Error(`Expected Error here, but got ${typeof e}: ${e}`)
        }
        console.log(
          `Login ${email} failed. This should be your REGULAR login (not an instance admin login) with ${PH_HOST}. Please check your credentials and try again.`
        )
        process.exit()
      }
    })
}
