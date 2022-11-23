import { spawn } from 'child_process'
import commandExists from 'command-exists'
import { Command } from 'commander'
import { PH_HOST } from '../env'
import { authCheck } from '../util/authCheck'
import { die } from '../util/die'
import { ensureWorker } from '../util/ensureWorker'
import { dbg } from '../util/logger'

export const addDevCommand = (program: Command) => {
  program
    .command('dev')
    .description('Run worker locally and watch for changes')
    .argument('<admin_email>', 'PocketBase admin email used to log in')
    .argument('<admin_password>', 'PocketBase admin password used to log in')
    .action(async (email, password) => {
      await authCheck()
      const { instance, path } = await ensureWorker()

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
