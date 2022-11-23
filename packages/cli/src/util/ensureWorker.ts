import { existsSync } from 'fs'
import { join } from 'path'
import { PH_CONFIG_FNAME, PH_HOST } from '../env'
import { client } from '../util/client'
import { die } from '../util/die'
import { getProject, getProjectRoot } from '../util/project'

export const ensureWorker = async () => {
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

  return { instance, path }
}
