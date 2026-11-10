import { Module } from '@nestjs/common';
import { AgentPythonClientService } from './agent-python-client.service';
import { FlowEngineService } from './flow-engine.service';
import { DslParserService } from './dsl-parser.service';

@Module({
  providers: [AgentPythonClientService, FlowEngineService, DslParserService],
  exports: [AgentPythonClientService, FlowEngineService, DslParserService],
})
export class AgentRuntimeModule {}
