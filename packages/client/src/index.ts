import {
  BackupInstancePayloadSchema,
  CreateInstancePayloadSchema,
  PublishBundlePayloadSchema,
  RestoreInstancePayloadSchema,
  RpcCommands,
  SaveSecretsPayloadSchema,
  // gen:rpc:import
  type BackupFields,
  type BackupInstancePayload,
  type BackupInstanceResult,
  type CreateInstancePayload,
  type CreateInstanceResult,
  type InstanceFields,
  type InstanceId,
  type InstanceRecordsById,
  type PublishBundlePayload,
  type PublishBundleResult,
  type RestoreInstancePayload,
  type RestoreInstanceResult,
  type SaveSecretsPayload,
  type SaveSecretsResult,
  type UserFields,
  type WorkerLogFields,
} from '@pockethost/schema'
import {
  assertExists,
  createEvent,
  createRpcHelper,
  createWatchHelper,
  type Logger,
  type PromiseHelper,
} from '@pockethost/tools'
import { keys, map } from '@s-libs/micro-dash'
import PocketBase, {
  Admin,
  BaseAuthStore,
  ClientResponseError,
  type RecordSubscription,
  type UnsubscribeFunc,
} from 'pocketbase'

export type AuthChangeHandler = (user: BaseAuthStore) => void

export type AuthToken = string
export type AuthStoreProps = {
  token: AuthToken
  model: UserFields | null
  isValid: boolean
}

export type PocketbaseClientConfig = {
  url: string
  logger: Logger
  promiseHelper: PromiseHelper
  storageProvider: BaseAuthStore
}
export type PocketbaseClient = ReturnType<typeof createPocketbaseClient>

export const createPocketbaseClient = (config: PocketbaseClientConfig) => {
  const { url, logger, promiseHelper, storageProvider } = config
  const { dbg, error } = logger
  const { safeCatch } = promiseHelper

  const client = new PocketBase(url, storageProvider)

  const { authStore } = client

  const user = () => authStore.model as AuthStoreProps['model']

  const isLoggedIn = () => authStore.isValid

  const logOut = () => authStore.clear()

  const createUser = safeCatch(
    `createUser`,
    (email: string, password: string) =>
      client
        .collection('users')
        .create({
          email,
          password,
          passwordConfirm: password,
        })
        .then(() => {
          // dbg(`Sending verification email to ${email}`)
          return client.collection('users').requestVerification(email)
        })
  )

  const confirmVerification = safeCatch(
    `confirmVerification`,
    (token: string) =>
      client
        .collection('users')
        .confirmVerification(token)
        .then((response) => {
          return response
        })
  )

  const requestPasswordReset = safeCatch(
    `requestPasswordReset`,
    (email: string) =>
      client
        .collection('users')
        .requestPasswordReset(email)
        .then(() => {
          return true
        })
  )

  const requestPasswordResetConfirm = safeCatch(
    `requestPasswordResetConfirm`,
    (token: string, password: string) =>
      client
        .collection('users')
        .confirmPasswordReset(token, password, password)
        .then((response) => {
          return response
        })
  )

  const authViaEmail = safeCatch(
    `authViaEmail`,
    (email: string, password: string) => {
      dbg(url)
      return client.collection('users').authWithPassword(email, password)
    }
  )

  const refreshAuthToken = safeCatch(`refreshAuthToken`, () =>
    client.collection('users').authRefresh()
  )

  const watchHelper = createWatchHelper({ client, promiseHelper, logger })
  const { watchById, watchAllById } = watchHelper
  const rpcMixin = createRpcHelper({
    client,
    watchHelper,
    promiseHelper,
    logger,
  })
  const { mkRpc } = rpcMixin

  /**
   * RPC calls
   */
  const publishBundle = mkRpc<PublishBundlePayload, PublishBundleResult>(
    RpcCommands.PublishBundle,
    PublishBundlePayloadSchema
  )
  const createInstance = mkRpc<CreateInstancePayload, CreateInstanceResult>(
    RpcCommands.CreateInstance,
    CreateInstancePayloadSchema
  )
  const createInstanceBackupJob = mkRpc<
    BackupInstancePayload,
    BackupInstanceResult
  >(RpcCommands.BackupInstance, BackupInstancePayloadSchema)
  const createInstanceRestoreJob = mkRpc<
    RestoreInstancePayload,
    RestoreInstanceResult
  >(RpcCommands.RestoreInstance, RestoreInstancePayloadSchema)
  const saveSecrets = mkRpc<SaveSecretsPayload, SaveSecretsResult>(
    RpcCommands.SaveSecrets,
    SaveSecretsPayloadSchema
  )
  // gen:rpc:wrapper

  const getInstanceById = safeCatch(
    `getInstanceById`,
    (id: InstanceId): Promise<InstanceFields | undefined> =>
      client.collection('instances').getOne<InstanceFields>(id)
  )

  const watchInstanceById = async (
    id: InstanceId,
    cb: (data: RecordSubscription<InstanceFields>) => void
  ): Promise<UnsubscribeFunc> => watchById('instances', id, cb)

  const watchBackupsByInstanceId = async (
    id: InstanceId,
    cb: (data: RecordSubscription<BackupFields>) => void
  ): Promise<UnsubscribeFunc> => watchAllById('backups', 'instanceId', id, cb)

  const getInstances = safeCatch(`getInstances`, async () => {
    const instances = await client
      .collection('instances')
      .getFullList<InstanceFields>()
    return instances
  })

  const getAllInstancesById = safeCatch(`getAllInstancesById`, async () => {
    const instances = await getInstances()
    const collection = instances.reduce((c, v) => {
      c[v.id] = v
      return c
    }, {} as InstanceRecordsById)
    return collection
  })

  const parseError = (e: Error): string[] => {
    if (!(e instanceof ClientResponseError)) return [e.message]
    if (e.data.message && keys(e.data.data).length === 0)
      return [e.data.message]
    return map(e.data.data, (v, k) => (v ? v.message : undefined)).filter(
      (v) => !!v
    )
  }

  const resendVerificationEmail = safeCatch(
    `resendVerificationEmail`,
    async () => {
      const user = client.authStore.model
      assertExists(user, `Login required`)
      await client.collection('users').requestVerification(user.email)
    }
  )

  const getAuthStoreProps = (): AuthStoreProps => {
    const { token, model, isValid } = client.authStore as AuthStoreProps
    // dbg(`current authStore`, { token, model, isValid })
    if (model instanceof Admin) throw new Error(`Admin models not supported`)
    if (model && !model.email)
      throw new Error(`Expected model to be a user here`)
    return {
      token,
      model,
      isValid,
    }
  }

  /**
   * Use synthetic event for authStore changers so we can broadcast just
   * the props we want and not the actual authStore object.
   */
  const [onAuthChange, fireAuthChange] = createEvent<AuthStoreProps>()

  /**
   * Fired when ready
   */
  const [onReady, fireReady] = createEvent<{}>()

  /**
   * This section is for initialization
   */
  {
    /**
     * Listen for native authStore changes and convert to synthetic event
     */
    client.authStore.onChange(() => {
      fireAuthChange(getAuthStoreProps())
    })

    /**
     * Refresh the auth token immediately upon creating the client. The auth token may be
     * out of date, or fields in the user record may have changed in the backend.
     */
    refreshAuthToken()
      .catch((e) => {
        dbg(`Not logged in`)
        // client.authStore.clear()
      })
      .finally(() => {
        fireAuthChange(getAuthStoreProps())
        fireReady({})
      })

    /**
     * Listen for auth state changes and subscribe to realtime _user events.
     * This way, when the verified flag is flipped, it will appear that the
     * authstore model is updated.
     *
     * Polling is a stopgap til v.0.8. Once 0.8 comes along, we can do a realtime
     * watch on the user record and update auth accordingly.
     */
    const unsub = onAuthChange((authStore) => {
      // dbg(`onAuthChange`, { ...authStore })
      const { model } = authStore
      if (!model) return
      if (model instanceof Admin) return
      if (model.verified) {
        unsub()
        return
      }
      const _check = safeCatch(`_checkVerified`, refreshAuthToken)
      setTimeout(_check, 1000)

      // FIXME - THIS DOES NOT WORK, WE HAVE TO POLL INSTEAD. FIX IN V0.8
      // dbg(`watching _users`)
      // unsub = subscribe<User>(`users/${model.id}`, (user) => {
      //   dbg(`realtime _users change`, { ...user })
      //   fireAuthChange({ ...authStore, model: user })
      // })
    })
  }

  const pReady = new Promise<void>((resolve) => {
    const unsub = onReady(() => {
      unsub()
      resolve()
    })
  })

  const watchInstanceLog = (
    instanceId: InstanceId,
    update: (logs: WorkerLogFields) => void,
    nInitial = 100
  ): (() => void) => {
    const cookie = client.authStore.exportToCookie()

    const stream = new EventSource(
      `${url}/logs/${instanceId}/${nInitial}?token=${cookie}`
    )

    stream.onmessage = (event) => {
      const {} = event
      const log = JSON.parse(event.data) as WorkerLogFields
      update(log)
    }

    return () => {
      stream.close()
    }
  }

  return {
    getAuthStoreProps,
    parseError,
    getInstanceById,
    authViaEmail,
    createUser,
    requestPasswordReset,
    requestPasswordResetConfirm,
    confirmVerification,
    logOut,
    onAuthChange,
    isLoggedIn,
    user,
    watchInstanceById,
    getInstances,
    getAllInstancesById,
    resendVerificationEmail,
    watchBackupsByInstanceId,
    createInstanceBackupJob,
    createInstanceRestoreJob,
    onReady,
    pReady,
    watchInstanceLog,

    /**
     * RPC
     */
    publishBundle,
    createInstance,
    saveSecrets,
    // gen:rpc:export
  }
}
