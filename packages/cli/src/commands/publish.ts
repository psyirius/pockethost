import { BufferList } from 'bl'
import { spawn } from 'child_process'
import commandExists from 'command-exists'
import { Command } from 'commander'
import { PH_HOST } from '../env'
import { authCheck } from '../util/authCheck'
import { client } from '../util/client'
import { die } from '../util/die'
import { ensureWorker } from '../util/ensureWorker'
import { dbg } from '../util/logger'
export const addPublishCommand = (program: Command) => {
  program
    .command('publish')
    .description(`Publish your worker to ${PH_HOST}`)
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
      const args = [`bundle`, path]

      dbg(`Spawning`, { cmd, args })
      const proc = spawn(cmd, args)
      proc.stderr.on('data', (buf: Buffer) => {
        process.stderr.write(buf)
      })
      const stdout = new BufferList()
      proc.stdout.on('data', (buf: Buffer) => {
        stdout.append(buf)
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
      proc.on('exit', async (code, signal) => {
        if (code !== 0) {
          die(`Unexpected 'deno' exit code: ${code}.`)
        }
        dbg(`Bundling complete`)
        const bundle = stdout.toString()
        const { publishBundle } = client()
        try {
          const bundleId = await publishBundle(instance.id, bundle)
          console.log(`Bundle published as ${bundleId}`)
        } catch (e) {
          die(`Bundle publishing failed with error ${e}`)
        }
      })
      proc.on('message', (...e) => {
        dbg(`message`, e)
      })
    })
}
