import { AgentRuntimeClient } from '../client/AgentRuntimeClient';
import { z } from 'zod';
import { AgentBlock } from './AgentBlock';
import { toOpenAITool } from './toOpenAITool';

/**
 * TranslateBlock: translates input text into English and returns a JSON object.
 */
export class TranslateBlock implements AgentBlock<string, { translation: string }> {
  private static translationSchema = z.object({ translation: z.string() });

  constructor(private agentClient: AgentRuntimeClient = new AgentRuntimeClient()) {}

  async run(input: string): Promise<{ translation: string }> {
    const prompt = `You are a translation assistant. Translate the following text into English. Return a JSON object with a single key "translation" whose value is the translated text, with no additional commentary.\n\nUSER:\n${input}`;
    const raw = await this.agentClient.run({ prompt });
    const parsedRaw = JSON.parse(raw);
    const parsed = TranslateBlock.translationSchema.parse(parsedRaw);
    return parsed;
  }

  /**
   * Define this block as an OpenAI Agent tool
   */
  static asTool() {
    return toOpenAITool({
      name: 'TranslateBlock',
      description: 'Translation assistant returning { translation: string }.',
      schema: z.object({ text: z.string() }),
    });
  }
}
