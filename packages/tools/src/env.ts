import { boolean } from 'boolean'

export const createEnv = (
  envResolver: (name: string, _default: string) => string
) => {
  const envi = (name: string, _default: number) =>
    parseInt(envResolver(name, _default.toString()))

  const envb = (name: string, _default: boolean) =>
    boolean(envResolver(name, _default.toString()))

  const envs = (name: string, _default: string) => envResolver(name, _default)

  return { envs, envi, envb }
}
