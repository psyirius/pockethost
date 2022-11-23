import { findUpSync } from 'find-up'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import produce from 'immer'
import { WritableDraft } from 'immer/dist/internal'
import { LocalStorage } from 'node-localstorage'
import { dirname, join } from 'path'
import { cwd } from 'process'
import { dbg } from './logger'

export type ProjectConfig = {
  host: string
  instanceId: string
  worker: {
    entry: string
  }
}

export const PROJECT_CONFIG_FNAME = `pockethost.json`
export const PROJECT_CACHE_FNAME = '.pockethost'
export const getProjectRoot = () => {
  const root = findUpSync(PROJECT_CONFIG_FNAME, {})
  if (!root) return cwd()
  return dirname(root)
}

export const localStorage = new LocalStorage(
  join(getProjectRoot(), PROJECT_CACHE_FNAME)
)

export const getProject = (): Partial<ProjectConfig> => {
  const path = join(getProjectRoot(), PROJECT_CONFIG_FNAME)

  if (!existsSync(path)) return {}
  const json = readFileSync(path).toString()
  const project = JSON.parse(json) as ProjectConfig
  dbg(project)
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
