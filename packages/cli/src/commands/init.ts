import { assertExists } from '@pockethost/tools'
import { map } from '@s-libs/micro-dash'
import { Command } from 'commander'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import prompts from 'prompts'
import { PH_ENTRY_PATH, PH_HOST } from '../env'
import template from '../templates/ts/index.ts.txt'
import { client } from '../util/client'
import { dbg, error, info } from '../util/logger'
import { getProject, getProjectRoot, setProject } from '../util/project'

const authCheck = async () => {
  const host = getProject()?.host || PH_HOST
  const { pReady, isLoggedIn, user } = client(host)
  await pReady
  if (!isLoggedIn()) {
    error(`Please use 'pockethost login' to log in before continuing.`)
    process.exit()
  }
  if (!user()?.verified) {
    error(
      `Your account must be verified first. Log in at https://pockethost.io to proceed.`
    )
    process.exit()
  }
}

export const addInitCommand = (program: Command) => {
  program
    .command('init')
    .description('Initialize a PocketHost project')

    .action(async () => {
      info(`Initializing new PocketHost project`)

      // Auth check
      await authCheck()

      /**
       * Choose an instance
       */
      {
        const project = getProject()
        assertExists(project, `Expected project here`)
        const { host } = project
        assertExists(host, `Expected valid host here`)

        const { getInstances } = client(host)
        const instances = await getInstances()
        if (instances.length === 0) {
          error(
            `You must create at least one instance at https://pockethost.io before continuing.`
          )
          process.exit()
        }

        const choices = map(instances, (i) => ({
          title: i.subdomain,
          value: i.id,
        })).sort((a, b) => (a.title < b.title ? -1 : 1))
        dbg(`instanceid check`)
        const response = await prompts([
          {
            type: 'select',
            name: 'instanceId',
            message: 'Choose your instance:',
            choices,
            // initial: project.instanceId,
          },
        ])
        dbg({ response })
        const { instanceId } = response
        setProject((project) => {
          project.instanceId = instanceId
        })
      }

      /**
       * Choose an entry point
       */
      {
        const project = getProject()
        assertExists(project, `Expected project here`)
        const { entry } = project.worker || {}
        const response = await prompts([
          {
            type: 'text',
            name: 'path',
            message: 'Worker entry point',
            initial: entry || PH_ENTRY_PATH,
            validate: (path: string) => !!path || `Enter any path`,
          },
        ])
        const { path } = response
        setProject((project) => {
          if (!project.worker) project.worker = { entry: path }
          project.worker.entry = path
        })
      }

      /**
       * Create a template at the entry path if one does not exist
       */
      {
        const project = getProject()
        assertExists(project, `Expected project here`)
        const { entry } = project.worker || {}
        assertExists(entry, `Expected entry path here`)
        const fullPath = join(getProjectRoot(), entry)
        if (!existsSync(fullPath)) {
          info(`Creating ${entry}`)
          mkdirSync(dirname(fullPath), { recursive: true })
          writeFileSync(fullPath, template)
        }
      }

      info(
        `Project has been initialized. You can change it in './pockethost.json'`
      )
    })
}
