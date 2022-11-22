import { map } from '@s-libs/micro-dash'
import { Command } from 'commander'
import prompts from 'prompts'
import { createClient } from '../util/createClient'
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
      const client = createClient()
      try {
        await client.logIn(`test2@benallfree.com`, `UE3qTy6qjmHYmw9`)
        const instances = await client.getInstances()
        const response = await prompts([
          {
            type: 'select',
            name: 'instanceId',
            message: 'Choose your instance:',
            validate: (value: string) => !!value || `Enter an email address`,
            choices: map(instances, (i) => ({
              title: i.subdomain,
              value: i.id,
            })).sort((a, b) => (a.title < b.title ? -1 : 1)),
          },
        ])
        const { instanceId } = response
        setProject((project) => {
          project.instanceId = instanceId
        })
        info(`You are now logged in.`)
      } catch (e: unknown) {
        if (!(e instanceof Error)) {
          throw new Error(`Expected Error here, but got ${typeof e}: ${e}`)
        }
        error(e)
      }
    })
}
