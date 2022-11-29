---
to: packages/daemon/src/services/RpcService/handlers/<%= name%>.ts
---
<%
const { changeCase } = h
const { upper, camel, pascal, snake, lower } = changeCase
const nameName = camel(name)
const NameName = pascal(name)
const NAME_NAME = upper(snake(NameName))
const NameDashName = lower(snake(NameName)).replace('_','-')
h.replace('./packages/daemon/src/services/RpcService/index.ts', /(\/\/ gen:handler)/, `${NameName} = '${NameDashName}'\n  $1`);
h.replace('./packages/daemon/src/services/RpcService/index.ts', /(\/\/ gen:import)/, `import { register${NameName}Handler } from './handlers/${NameName}'$1`);
%>
import {
  <%= NameName %>Payload,
  <%= NameName %>PayloadSchema,
  <%= NameName %>Result,
  RpcCommands,
} from '@pockethost/schema'
import { RpcHandlerFactory } from '..'

export const register<%= NameName %>Handler: RpcHandlerFactory = ({
  client,
  rpcService: { registerCommand },
}) => {
  registerCommand<<%= NameName %>Payload, <%= NameName %>Result>(
    RpcCommands.<%= NameName %>,
    <%= NameName %>PayloadSchema,
    async (job) => {
      const { payload } = job
      
      return { }
    }
  )
}
