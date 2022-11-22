/// <reference types="node" />
import { env as _env } from 'process'

export const nodeEnvResolver = (name: string, _default: string = '') => {
  const v = _env[name]
  if (!v) return _default
  return v
}
