import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AgentService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY,
    });
  }

  async run(prompt: string, parameters: Record<string, any> = {}) {
    try {
      // Summarize block via Responses API
      const systemPrompt = parameters.systemPrompt || 'Summarize the following text:';
      const response = await this.openai.responses.create({
        model: parameters.model || process.env.OPENAI_MODEL || 'o4-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      });
      return response;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('Agent execution failed');
    }
  }
}
