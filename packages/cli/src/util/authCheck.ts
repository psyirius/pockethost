import { PH_HOST } from '../env'
import { client } from '../util/client'
import { getProject } from '../util/project'
import { die } from './die'

export const authCheck = async () => {
  const host = getProject()?.host || PH_HOST
  const { pReady, isLoggedIn, user } = client(host)
  await pReady
  if (!isLoggedIn()) {
    die(`Please use 'pockethost login' to log in before continuing.`)
  }
  if (!user()?.verified) {
    die(
      `Your account must be verified first. Log in at https://pockethost.io to proceed.`
    )
  }
}
