import { InvoiceExtractorBlock } from './InvoiceExtractorBlock';
import { S3Service } from '../client/S3Service';

describe('InvoiceExtractorBlock', () => {
  let s3: jest.Mocked<S3Service>;
  let block: InvoiceExtractorBlock;

  beforeEach(() => {
    s3 = {
      uploadData: jest.fn().mockResolvedValue(undefined),
      generatePresignedUrl: jest.fn().mockResolvedValue('http://signed-url'),
    } as any;
    block = new InvoiceExtractorBlock(s3);
  });

  it('should extract invoice numbers and upload them', async () => {
    const input = 'Please pay INV-12345 ASAP. Also see INV-67890';
    const result = await block.run(input);

    expect(s3.uploadData).toHaveBeenCalledTimes(1);
    const [bufferArg, keyArg] = s3.uploadData.mock.calls[0];
    expect(bufferArg.toString()).toBe('INV-12345, INV-67890');
    expect(keyArg).toMatch(/^invoices\/.*\.txt$/);
    expect(s3.generatePresignedUrl).toHaveBeenCalledWith(keyArg);
    expect(result).toBe('http://signed-url');
  });

  it('should handle no matches', async () => {
    const input = 'No invoices here';
    const result = await block.run(input);

    expect(s3.uploadData).toHaveBeenCalledTimes(1);
    const [bufferArg] = s3.uploadData.mock.calls[0];
    expect(bufferArg.toString()).toBe('');
    expect(result).toBe('http://signed-url');
  });
});
