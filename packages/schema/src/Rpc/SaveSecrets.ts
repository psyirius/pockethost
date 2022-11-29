
import { JSONSchemaType } from 'ajv'

export type SaveSecretsPayload = {
  // Example
  foo: string
}

export type SaveSecretsResult = {
  // Add result fields here 
}

export const SaveSecretsPayloadSchema: JSONSchemaType<SaveSecretsPayload> =
  {
    type: 'object',
    properties: {
      // Example
      foo: { type: 'string' },
    },
    required: ['foo'],
    additionalProperties: false,
  }

