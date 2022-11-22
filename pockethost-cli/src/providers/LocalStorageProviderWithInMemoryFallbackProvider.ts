import { IStorageProvider } from './LocalStorageCompatibleAuthStore'

export class LocalStorageProviderWithInMemoryFallbackProvider
  implements IStorageProvider
{
  private storageFallback: { [key: string]: any } = {}

  getItem(key: string): string | null {
    if (typeof window !== 'undefined' && window?.localStorage) {
      return window.localStorage.getItem(key)
    }
    // fallback
    return this.storageFallback[key] || null
  }

  setItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window?.localStorage) {
      window.localStorage.setItem(key, value)
    } else {
      // store in fallback
      this.storageFallback[key] = value
    }
  }

  removeItem(key: string): void {
    // delete from local storage
    if (typeof window !== 'undefined' && window?.localStorage) {
      window.localStorage?.removeItem(key)
    }

    // delete from fallback
    delete this.storageFallback[key]
  }

  clear(): void {
    // delete from local storage
    if (typeof window !== 'undefined' && window?.localStorage) {
      window.localStorage?.clear()
    }

    // delete from fallback
    this.storageFallback = {}
  }
}
