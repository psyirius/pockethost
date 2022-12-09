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
      let lastSeen: string | undefined = undefined
      const unsub = watchInstanceLog(
        instance.id,
        (log) => {
          const dt = log.created
          // dbg(
          //   `Examining ${log.id} ${dt} against ${lastSeen}`,
          //   lastSeen ? dt < lastSeen : 'false'
          // )
          if (lastSeen && dt < lastSeen) return
          lastSeen = dt
          console.log(`[${dt}] [${log.stream}] ${log.message.trim()}`)
        },
        nInitial
      )
    })
}
