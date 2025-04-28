import { EmailClassifierBlock } from './EmailClassifierBlock';
import { S3Service } from '../client/S3Service';

describe('EmailClassifierBlock', () => {
  let s3: jest.Mocked<S3Service>;
  let block: EmailClassifierBlock;

  beforeEach(() => {
    s3 = {
      uploadData: jest.fn().mockResolvedValue(undefined),
      generatePresignedUrl: jest.fn().mockResolvedValue('http://signed-url'),
    } as any;
    block = new EmailClassifierBlock(s3);
  });

  it('should classify invoice emails', async () => {
    const input = 'Your invoice is attached';
    const result = await block.run(input);

    expect(s3.uploadData).toHaveBeenCalledTimes(1);
    const [bufferArg, keyArg] = s3.uploadData.mock.calls[0];
    expect(bufferArg.toString()).toBe(JSON.stringify({ category: 'invoice' }));
    expect(keyArg).toMatch(/^classifications\/.*\.json$/);
    expect(s3.generatePresignedUrl).toHaveBeenCalledWith(keyArg);
    expect(result).toBe('http://signed-url');
  });

  it('should classify urgent emails', async () => {
    const input = 'Please respond ASAP';
    await block.run(input);
    expect(s3.uploadData).toHaveBeenCalledTimes(1);
    const [bufferArg] = s3.uploadData.mock.calls[0];
    expect(JSON.parse(bufferArg.toString())).toEqual({ category: 'urgent' });
  });

  it('should classify other emails', async () => {
    const input = 'Hello friend';
    await block.run(input);
    expect(s3.uploadData).toHaveBeenCalledTimes(1);
    const [bufferArg] = s3.uploadData.mock.calls[0];
    expect(JSON.parse(bufferArg.toString())).toEqual({ category: 'other' });
  });
});
