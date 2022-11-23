import { spawn } from 'child_process'
import commandExists from 'command-exists'
import { Command } from 'commander'
import { existsSync } from 'fs'
import { join } from 'path'
import { PH_CONFIG_FNAME, PH_HOST } from '../env'
import { authCheck } from '../util/authCheck'
import { client } from '../util/client'
import { die } from '../util/die'
import { dbg } from '../util/logger'
import { getProject, getProjectRoot } from '../util/project'

export const addPublishCommand = (program: Command) => {
  program
    .command('publish')
    .description(`Publish your worker to ${PH_HOST}`)
    .action(async (email, password) => {
      await authCheck()
      const { worker, instanceId } = getProject()

      if (!instanceId) {
        die(
          `Instance not defined in ${PH_CONFIG_FNAME}. Use 'pockethost init' to fix`
        )
      }
      const { getInstanceById } = client()
      const instance = await (async () => {
        try {
          return await getInstanceById(instanceId)
        } catch (e) {}
      })()
      if (!instance) {
        die(`Unable to retrieve instance ${instanceId} from ${PH_HOST}.`)
      }

      const { entry } = worker || {}
      if (!entry) {
        die(
          `Entry point not found in ${PH_CONFIG_FNAME}. Use 'pockethost init' to fix.`
        )
      }
      const path = join(getProjectRoot(), entry)
      if (!existsSync(path)) {
        die(`Entry ${path} not found. Use 'pockethost init' to fix.`)
      }

      const cmd = `deno`
      const hasDeno = await commandExists(cmd)
      if (!hasDeno) {
        die(`'deno' but be installed. https://deno.land.`)
      }

      const instanceHost = `${instance.subdomain}.${PH_HOST}`
      //  deno  index.ts
      const args = [
        `run`,
        `--allow-env=POCKETBASE_URL,ADMIN_LOGIN,ADMIN_PASSWORD`,
        `--allow-net=${instanceHost}:443`,
        `--unsafely-ignore-certificate-errors`,
        `--watch`,
        path,
      ]
      const env = {
        ...process.env,
        POCKETBASE_URL: `https://${instanceHost}`,
        ADMIN_LOGIN: email,
        ADMIN_PASSWORD: password,
      }
      dbg(`Spawning`, { cmd, args, env })
      const proc = spawn(cmd, args, { env })
      proc.stderr.on('data', (buf: Buffer) => {
        process.stderr.write(buf)
      })
      proc.stdout.on('data', (buf: Buffer) => {
        process.stdout.write(buf)
      })
      proc.on('spawn', (...e) => {
        dbg(`spawn`, e)
      })
      proc.on('error', (...e) => {
        dbg(`error`, e)
      })
      proc.on('disconnect', () => {
        dbg(`disconnect`)
      })
      proc.on('close', (...e) => {
        dbg(`close`, e)
      })
      proc.on('exit', (...e) => {
        dbg(`exit`, e)
      })
      proc.on('message', (...e) => {
        dbg(`message`, e)
      })
    })
}
