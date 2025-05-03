export interface OpenAITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  toolType: 'backend' | 'function';
  toolId: string;
}

export class SummarizeBlock {
  constructor(
    public readonly id: string,
    public readonly description: string,
  ) {}

  toOpenAITool(): OpenAITool {
    return {
      name: this.id,
      description: this.description,
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
      toolType: 'backend',
      toolId: 'summarize-block',
    };
  }
}
