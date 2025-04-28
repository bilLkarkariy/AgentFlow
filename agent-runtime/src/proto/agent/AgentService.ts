// Original file: proto/agent.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { RunRequest as _agent_RunRequest, RunRequest__Output as _agent_RunRequest__Output } from '../agent/RunRequest';
import type { RunResponse as _agent_RunResponse, RunResponse__Output as _agent_RunResponse__Output } from '../agent/RunResponse';

export interface AgentServiceClient extends grpc.Client {
  Run(metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientDuplexStream<_agent_RunRequest, _agent_RunResponse__Output>;
  Run(options?: grpc.CallOptions): grpc.ClientDuplexStream<_agent_RunRequest, _agent_RunResponse__Output>;
  run(metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientDuplexStream<_agent_RunRequest, _agent_RunResponse__Output>;
  run(options?: grpc.CallOptions): grpc.ClientDuplexStream<_agent_RunRequest, _agent_RunResponse__Output>;
  
}

export interface AgentServiceHandlers extends grpc.UntypedServiceImplementation {
  Run: grpc.handleBidiStreamingCall<_agent_RunRequest__Output, _agent_RunResponse>;
  
}

export interface AgentServiceDefinition extends grpc.ServiceDefinition {
  Run: MethodDefinition<_agent_RunRequest, _agent_RunResponse, _agent_RunRequest__Output, _agent_RunResponse__Output>
}
