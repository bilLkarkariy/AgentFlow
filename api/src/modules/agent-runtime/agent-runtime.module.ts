import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentPythonClientService } from './agent-python-client.service';

@Module({
  imports: [
    ...(process.env.JEST_WORKER_ID ? [] : [
      ClientsModule.register([
        {
          name: 'AGENT_RUNTIME',
          transport: Transport.GRPC,
          options: {
            package: 'agent',
            // point to dist root agent.proto
            protoPath: join(__dirname, '..', '..', '..', '..', 'agent-runtime', 'proto', 'agent.proto'),
            url: process.env.AGENT_RUNTIME_GRPC_URL || 'localhost:50051',
          },
        },
        {
          name: 'AG_PY',
          transport: Transport.GRPC,
          options: {
            package: 'agent',
            protoPath: join(__dirname, '..', '..', '..', '..', 'agent-runtime', 'proto', 'agent.proto'),
            url: process.env.AGENT_RUNTIME_GRPC_URL || 'localhost:50051',
          },
        },
      ]),
    ]),
  ],
  providers: [AgentRuntimeService, AgentPythonClientService],
  exports: [AgentRuntimeService, AgentPythonClientService],
})
export class AgentRuntimeModule {}
