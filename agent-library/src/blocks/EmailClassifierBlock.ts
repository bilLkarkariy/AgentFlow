import { AgentBlock } from './AgentBlock';
import { S3Service } from '../client/S3Service';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { toOpenAITool } from './toOpenAITool';

/**
 * Classifies email content into categories and uploads result to S3 as JSON.
 */
export class EmailClassifierBlock implements AgentBlock<string, string> {
  /**
   * Define this block as an OpenAI Agent tool
   */
  static asTool() {
    return toOpenAITool({
      name: 'EmailClassifierBlock',
      description: 'Classify email content into categories and return presigned URL.',
      schema: z.object({ text: z.string() }),
    });
  }

  constructor(private s3: S3Service) {}

  async run(input: string): Promise<string> {
    let category: string;
    if (/invoice/i.test(input)) {
      category = 'invoice';
    } else if (/urgent|asap|important/i.test(input)) {
      category = 'urgent';
    } else {
      category = 'other';
    }
    const result = JSON.stringify({ category });
    const key = `classifications/${uuidv4()}.json`;
    await this.s3.uploadData(Buffer.from(result, 'utf-8'), key);
    return this.s3.generatePresignedUrl(key);
  }
}
