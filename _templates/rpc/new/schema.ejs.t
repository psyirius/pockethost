---
to: packages/schema/src/Rpc/<%= name%>.ts
---
<%
const { changeCase } = h
const { upper, camel, pascal, snake, } = changeCase
const nameName = camel(name)
const NameName = pascal(name)
const NAME_NAME = upper(snake(NameName))
const NameDashName = snake(NameName).replace('_','-')
h.replace('./packages/schema/src/Rpc/index.ts', /gen:enum/, `\n  s${NameName} = '${NameDashName.toLower()}'`);
h.replace('./packages/schema/src/Rpc/index.ts', /gen:array/, `,\n  RpcCommands.${NameName}`);
h.replace('./packages/schema/src/Rpc/index.ts', /gen:export/, `\nexport * from './${NameName}'`);
%>
import { JSONSchemaType } from 'ajv'
import { InstanceFields } from '../Instance'
import { Subdomain } from '../types'

export type <%= NameName %>Payload = {
  subdomain: Subdomain
}

export type <%= NameName %>Result = {
  instance: InstanceFields
}

export const <%= NameName %>PayloadSchema: JSONSchemaType<<%= NameName %>Payload> =
  {
    type: 'object',
    properties: {
      foo: { type: 'string' },
    },
    required: ['foo'],
    additionalProperties: false,
  }

