import { Body, Controller, Post } from '@nestjs/common';
import { AgentService } from '../services/agent.service';
import { RunDto } from '../dto/run.dto';

@Controller()
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('run')
  async run(@Body() dto: RunDto) {
    const response: any = await this.agent.run(dto.prompt, dto.parameters);
    // map Responses API output_text; stringify if object
    const raw = response.output_text ?? '';
    const text = typeof raw === 'object' ? JSON.stringify(raw) : raw;
    const output = [{ content: [{ text }] }];
    return { output };
  }
}
