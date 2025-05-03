import { Module } from '@nestjs/common';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentPythonClientService } from './agent-python-client.service';
import { FlowEngineService } from './flow-engine.service';
import { DslParserService } from './dsl-parser.service';

@Module({
  providers: [AgentRuntimeService, AgentPythonClientService, FlowEngineService, DslParserService],
  exports: [AgentRuntimeService, AgentPythonClientService, FlowEngineService, DslParserService],
})
export class AgentRuntimeModule {}
