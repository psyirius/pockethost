---
to: packages/schema/src/Rpc/<%= name%>.ts
---
<%
const { changeCase } = h
const { upper, camel, pascal, snake, lower } = changeCase
const nameName = camel(name)
const NameName = pascal(name)
const NAME_NAME = upper(snake(NameName))
const NameDashName = lower(snake(NameName)).replace('_','-')
h.replace('./packages/schema/src/Rpc/index.ts', /(\/\/ gen:enum)/, `${NameName} = '${NameDashName}'\n  $1`);
h.replace('./packages/schema/src/Rpc/index.ts', /(\/\/ gen:array)/, `RpcCommands.${NameName},\n  $1`);
h.replace('./packages/schema/src/Rpc/index.ts', /(\/\/ gen:export)/, `export * from './${NameName}'\n$1`);
%>
import { JSONSchemaType } from 'ajv'

export type <%= NameName %>Payload = {
  // Example
  foo: string
}

export type <%= NameName %>Result = {
  // Add result fields here 
}

export const <%= NameName %>PayloadSchema: JSONSchemaType<<%= NameName %>Payload> =
  {
    type: 'object',
    properties: {
      // Example
      foo: { type: 'string' },
    },
    required: ['foo'],
    additionalProperties: false,
  }

