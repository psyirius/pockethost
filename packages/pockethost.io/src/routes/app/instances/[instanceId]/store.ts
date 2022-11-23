import type { InstanceFields } from '@pockethost/schema'
import { writable } from 'svelte/store'

export const instance = writable<InstanceFields | undefined>()
