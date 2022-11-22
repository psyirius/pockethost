import { LocalStorageCompatibleAuthStore } from './LocalStorageCompatibleAuthStore'
import { LocalStorageProviderWithInMemoryFallbackProvider } from './LocalStorageProviderWithInMemoryFallbackProvider'

/**
 * The default token store for browsers with auto fallback
 * to runtime/memory if local storage is undefined (eg. in node env).
 */

export class LocalAuthStore extends LocalStorageCompatibleAuthStore {
  constructor(storageKey = 'pocketbase_auth') {
    const storageProvider =
      new LocalStorageProviderWithInMemoryFallbackProvider()
    super(storageKey, storageProvider)
  }
}
