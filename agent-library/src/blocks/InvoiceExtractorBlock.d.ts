import { AgentBlock } from './AgentBlock';
import { S3Service } from '../client/S3Service';
export declare class InvoiceExtractorBlock implements AgentBlock<string, string> {
    private s3;
    constructor(s3: S3Service);
    run(input: string): Promise<string>;
}
