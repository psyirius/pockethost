import { InstanceFields, StreamNames } from '@pockethost/schema'
import Bottleneck from 'bottleneck'
import { spawn } from 'child_process'
import { join } from 'path'
import { DAEMON_PB_DATA_DIR } from '../../constants'
import { mkInternalAddress, mkInternalUrl } from '../../util/internal'
import { dbg } from '../../util/logger'
import { createWorkerLogger } from '../WorkerService/WorkerLogger'

export type DenoProcessConfig = {
  port: number
  instance: InstanceFields
}
export const createDenoProcess = async (config: DenoProcessConfig) => {
  const { instance, port } = config
  const internalUrl = mkInternalUrl(port)
  const instanceAddress = mkInternalAddress(port)

  const { currentWorkerBundleId } = instance
  const secrets = instance.secrets || {}

  const cmd = `deno`
  //  deno  index.ts
  const args = [
    `run`,
    `--allow-env=POCKETBASE_URL,ADMIN_LOGIN,ADMIN_PASSWORD`,
    `--allow-net=${instanceAddress}`,
    join(
      DAEMON_PB_DATA_DIR,
      instance.id,
      `worker`,
      `bundles`,
      `${currentWorkerBundleId}.js`
    ),
  ]

  const denoLogger = await createWorkerLogger(instance.id)
  const denoLogLimiter = new Bottleneck({ maxConcurrent: 1 })
  const denoWrite = (message: string, stream: StreamNames = StreamNames.Info) =>
    denoLogLimiter.schedule(() => {
      dbg(`[${instance.id}:${currentWorkerBundleId}:${stream}] ${message}`)
      return denoLogger.write(currentWorkerBundleId, message, stream)
    })

  const env = {
    /**
     * MAJOR SECURITY WARNING. DO NOT PASS process.env OR THE INSTANCE WILL
     * GET FULL ADMIN CONTROL
     */
    POCKETBASE_URL: internalUrl,
    ...secrets,
    NO_COLOR: '1',
  }
  denoWrite(`Worker starting`, StreamNames.System)
  dbg(`Worker starting`, cmd, args, env)
  const denoProcess = spawn(cmd, args, { env })
  denoProcess.stderr.on('data', (buf: Buffer) => {
    denoWrite(buf.toString(), StreamNames.Error)
  })
  denoProcess.stdout.on('data', (buf: Buffer) => {
    denoWrite(buf.toString())
  })
  denoProcess.on('exit', async (code, signal) => {
    if (code !== 0) {
      denoWrite(`Unexpected 'deno' exit code: ${code}.`, StreamNames.Error)
    }
    denoWrite(`Worker shutting down`, StreamNames.System)
  })

  return {
    shutdown: () => {
      denoProcess.kill()
    },
  }
}
