import { Command } from 'commander'
import { PH_HOST } from '../env'
import { client } from '../util/client'
import { dbg, error, info } from '../util/logger'
import { getProject, setProject } from '../util/project'

export const addLoginCommand = (program: Command) => {
  program
    .command('login')
    .description('Log in to PocketHost')
    .argument('<email>', 'Email')
    .argument('<password>', 'Password')

    .action(async (email, password, options) => {
      dbg(`Options`, options)
      setProject((project) => {
        project.host = project.host || PH_HOST
      })
      const { host } = getProject()
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
