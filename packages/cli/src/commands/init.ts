import { assertExists } from '@pockethost/tools'
import { map } from '@s-libs/micro-dash'
import { Command } from 'commander'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import inquirer from 'inquirer'
import { dirname, join } from 'path'
import { PH_ENTRY_PATH } from '../env'
import template from '../templates/ts/index.ts.txt'
import { authCheck } from '../util/authCheck'
import { client } from '../util/client'
import { die } from '../util/die'
import { dbg, info } from '../util/logger'
import { getProject, getProjectRoot, setProject } from '../util/project'

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
          die(
            `You must create at least one instance at https://pockethost.io before continuing.`
          )
        }

        const choices = map(instances, (i) => ({
          name: i.subdomain,
          value: i.id,
        })).sort((a, b) => (a.name < b.name ? -1 : 1))
        dbg(`instanceid check`)
        const response = await inquirer.prompt([
          {
            type: 'list',
            name: 'instanceId',
            message: 'Choose your instance:',
            choices,
            default: project.instanceId,
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
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'path',
            message: 'Worker entry point',
            default: entry || PH_ENTRY_PATH,
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
