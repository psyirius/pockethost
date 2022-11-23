import { JSONSchemaType } from 'ajv'
import { InstanceId, RecordId } from '../types'

export type PublishBundlePayload = {
  instanceId: InstanceId
  bundle: string
}

export const PublishBundlePayloadSchema: JSONSchemaType<PublishBundlePayload> =
  {
    type: 'object',
    properties: {
      instanceId: { type: 'string' },
      bundle: { type: 'string' },
    },
    required: ['instanceId', 'bundle'],
    additionalProperties: false,
  }

export type PublishBundleResult = { bundleId: RecordId }
