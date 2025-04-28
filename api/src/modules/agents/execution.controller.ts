import { Controller, Param, Post, HttpCode } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentPythonClientService } from '../agent-runtime/agent-python-client.service';
import { firstValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';

@Controller('agents')
export class ExecutionController {
  constructor(
    private readonly agents: AgentsService,
    private readonly agentPython: AgentPythonClientService,
  ) {}

  @HttpCode(200)
  @Post('execute/:id')
  async execute(@Param('id') id: string) {
    const agent = await this.agents.findOne(id);
    if (!agent) {
      return { error: 'Agent not found' };
    }
    // Convert DSL object to string prompt
    const prompt = typeof agent.dsl === 'string' ? agent.dsl : JSON.stringify(agent.dsl);
    const responses = await firstValueFrom(
      this.agentPython.runAgent({ prompt, parameters: {} }).pipe(toArray()),
    );
    const chunks = responses.map(r => r.token);
    return { result: chunks };
  }
}
