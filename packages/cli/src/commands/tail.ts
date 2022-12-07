import { Command } from 'commander'
import { authCheck } from '../util/authCheck'
import { client } from '../util/client'
import { ensureWorker } from '../util/ensureWorker'
export const addTailCommand = (program: Command) => {
  program
    .command('tail')
    .description(`Tail the live log of your worker running on PocketHost.io`)
    .option(`-n,--initial-count`, `The initial number of logs to tail`, `100`)
    .action(async (options) => {
      await authCheck()
      const nInitial = parseInt(options.n || 100, 10)
      const { instance, path } = await ensureWorker()

      const { watchInstanceLog } = client()
      const unsub = watchInstanceLog(
        instance.id,
        (log) => {
          console.log(`[${log.created}] [${log.stream}] ${log.message.trim()}`)
        },
        nInitial
      )
    })
}
