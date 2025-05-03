import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { AgentPythonClientService } from './agent-python-client.service';

@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);

  constructor(private readonly python: AgentPythonClientService) {}

  async run(prompt: string, parameters: Record<string, any>): Promise<string[]> {
    const responses = await firstValueFrom(
      this.python.runAgent({ prompt, parameters }).pipe(toArray()),
    );
    return responses.map(r => r.token);
  }
}
