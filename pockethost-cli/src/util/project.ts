import { findUpSync } from 'find-up'
import { readFileSync, writeFileSync } from 'fs'
import produce from 'immer'
import { WritableDraft } from 'immer/dist/internal'
import { LocalStorage } from 'node-localstorage'
import { dirname, join } from 'path'
import { cwd } from 'process'

export type ProjectConfig = {
  host: string
  instanceId: string
  worker: {
    entry: string
  }
}

const PROJECT_CONFIG_FNAME = `pockethost.json`
const PROJECT_CACHE_FNAME = '.pockethost'

const getProjectRoot = () => {
  const root = findUpSync(PROJECT_CONFIG_FNAME)
  if (!root) return cwd()
  return dirname(root)
}

export const localStorage = new LocalStorage(
  join(getProjectRoot(), PROJECT_CACHE_FNAME)
)

export const getProject = (): Partial<ProjectConfig> => {
  const path = join(getProjectRoot(), PROJECT_CONFIG_FNAME)

  const json = readFileSync(path).toString()
  const project = JSON.parse(json) as ProjectConfig
  return project
}

export const setProject = (
  mutator: (project: WritableDraft<Partial<ProjectConfig>>) => void
) => {
  const project = getProject()
  const nextProject = produce(project, mutator)
  const path = join(getProjectRoot(), PROJECT_CONFIG_FNAME)
  writeFileSync(path, JSON.stringify(nextProject, null, 2))
}
