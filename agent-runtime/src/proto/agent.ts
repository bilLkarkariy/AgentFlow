import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { AgentServiceClient as _agent_AgentServiceClient, AgentServiceDefinition as _agent_AgentServiceDefinition } from './agent/AgentService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  agent: {
    AgentService: SubtypeConstructor<typeof grpc.Client, _agent_AgentServiceClient> & { service: _agent_AgentServiceDefinition }
    RunRequest: MessageTypeDefinition
    RunResponse: MessageTypeDefinition
  }
}

