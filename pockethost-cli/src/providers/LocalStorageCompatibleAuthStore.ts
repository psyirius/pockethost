import { Admin, BaseAuthStore, Record } from 'pocketbase'
import { IStorageProvider } from './IStorageProvider'

/**
 * The default token store for browsers with auto fallback
 * to runtime/memory if local storage is undefined (eg. in node env).
 */
export class LocalStorageCompatibleAuthStore extends BaseAuthStore {
  private storageKey: string
  private storageProvider: IStorageProvider

  constructor(
    storageKey = 'pocketbase_auth',
    storageProvider: IStorageProvider
  ) {
    super()

    this.storageKey = storageKey
    this.storageProvider = storageProvider
  }

  /**
   * @inheritdoc
   */
  get token(): string {
    const data = this._storageGet(this.storageKey) || {}

    return data.token || ''
  }

  /**
   * @inheritdoc
   */
  get model(): Record | Admin | null {
    const data = this._storageGet(this.storageKey) || {}

    if (
      data === null ||
      typeof data !== 'object' ||
      data.model === null ||
      typeof data.model !== 'object'
    ) {
      return null
    }

    // admins don't have `collectionId` prop
    if (typeof data.model?.collectionId === 'undefined') {
      return new Admin(data.model)
    }

    return new Record(data.model)
  }

  /**
   * @inheritdoc
   */
  save(token: string, model: Record | Admin | null) {
    this._storageSet(this.storageKey, {
      token: token,
      model: model,
    })

    super.save(token, model)
  }

  /**
   * @inheritdoc
   */
  clear() {
    this._storageRemove(this.storageKey)

    super.clear()
  }

  // ---------------------------------------------------------------
  // Internal helpers:
  // ---------------------------------------------------------------

  /**
   * Retrieves `key` from the browser's local storage
   * (or runtime/memory if local storage is undefined).
   */
  private _storageGet(key: string): any {
    const rawValue = this.storageProvider.getItem(key) || ''
    try {
      return JSON.parse(rawValue)
    } catch (e) {
      // not a json
      return rawValue
    }
  }

  /**
   * Stores a new data in the browser's local storage
   * (or runtime/memory if local storage is undefined).
   */
  private _storageSet(key: string, value: any) {
    // store in local storage
    let normalizedVal = value
    if (typeof value !== 'string') {
      normalizedVal = JSON.stringify(value)
    }
    this.storageProvider.setItem(key, normalizedVal)
  }

  /**
   * Removes `key` from the browser's local storage and the runtime/memory.
   */
  private _storageRemove(key: string) {
    // delete from local storage
    this.storageProvider.removeItem(key)
  }
}
