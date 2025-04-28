import { Injectable, InternalServerErrorException, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import type { OpenAIToolDefinition } from '@agentflow/agent-library';

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);

  private agentStub: any;

  constructor(@Inject('AGENT_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.agentStub = this.client.getService<any>('AgentService');
  }

  async run(dsl: string, parameters: Record<string, any> = {}, tools: OpenAIToolDefinition[] = []) {
    try {
      const stream: Observable<{ token: string }> = this.agentStub.Run({ prompt: dsl, parameters, toolsJson: JSON.stringify(tools) });
      let output = '';
      await new Promise<void>((resolve, reject) => {
        stream.subscribe({
          next: (res) => (output += `${res.token} `),
          error: reject,
          complete: () => resolve(),
        });
      });
      return JSON.parse(output.trim());
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('Agent execution failed');
    }
  }
}
