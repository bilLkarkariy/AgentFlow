import { AgentBlock } from './AgentBlock';
import { S3Service } from '../client/S3Service';
import { v4 as uuidv4 } from 'uuid';
import { toOpenAITool } from './toOpenAITool';
import { z } from 'zod';

/**
 * Extracts invoice-like numbers (e.g., INV-12345) and uploads to S3 as text.
 */
export class InvoiceExtractorBlock implements AgentBlock<string, string> {
  /**
   * Define this block as an OpenAI Agent tool
   */
  static asTool() {
    return toOpenAITool({
      name: 'InvoiceExtractorBlock',
      description: 'Extract invoice numbers and upload to S3, returns presigned URL.',
      schema: z.object({ text: z.string() }),
    });
  }

  constructor(private s3: S3Service) {}

  async run(input: string): Promise<string> {
    const matches = input.match(/INV-\d+/g) || [];
    const extracted = matches.join(', ');
    const key = `invoices/${uuidv4()}.txt`;
    await this.s3.uploadData(Buffer.from(extracted, 'utf-8'), key);
    return this.s3.generatePresignedUrl(key);
  }
}
