import { client } from '../util/client'
import { die } from './die'

export const authCheck = async () => {
  const { pReady, isLoggedIn, user } = client()
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
