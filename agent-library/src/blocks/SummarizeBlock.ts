import { AgentBlock } from './AgentBlock';
import { AgentRuntimeClient } from '../client/AgentRuntimeClient';
import { z } from 'zod';
import { toOpenAITool } from './toOpenAITool';

/**
 * Simple summarization block: uses OpenAI o4-mini for summarization and returns a JSON object.
 */
export class SummarizeBlock implements AgentBlock<string, { summary: string }> {
  private static summarySchema = z.object({ summary: z.string() });

  /**
   * Define this block as an OpenAI Agent tool
   */
  static asTool() {
    return toOpenAITool({
      name: 'SummarizeBlock',
      description: 'Summarization assistant returning { summary: string }.',
      schema: z.object({ text: z.string() }),
    });
  }

  constructor(private agentClient: AgentRuntimeClient = new AgentRuntimeClient()) {}

  async run(input: string): Promise<{ summary: string }> {
    // Use Responses API with structured output
    const prompt = `You are an expert summarization assistant. Return a JSON object with a single key "summary" whose value is a concise summary (max 3 sentences). Do not include other commentary.\n\nUSER:\n${input}`;
    const raw = await this.agentClient.run({ prompt });
    const parsedRaw = JSON.parse(raw);
    const parsed = SummarizeBlock.summarySchema.parse(parsedRaw);
    return parsed;
  }
}
