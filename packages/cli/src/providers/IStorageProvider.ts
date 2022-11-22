/**
 * This is the
 */

export type IStorageProvider = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
}
