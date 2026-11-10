import { NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DLQBullService } from './dlq-bull.service';

describe('DLQBullService', () => {
  const failedOf = (id: string) =>
    ({ getFailed: jest.fn().mockResolvedValue([{ id }]) }) as unknown as Queue;
  const service = new DLQBullService(failedOf('run-job'), failedOf('agents-job'));

  it('reads the failed jobs of the queue it is asked for', async () => {
    expect(await service.getFailed('agent-run')).toEqual([{ id: 'run-job' }]);
    expect(await service.getFailed('agents')).toEqual([{ id: 'agents-job' }]);
  });

  it('rejects a queue it does not know instead of reading another one', async () => {
    await expect(service.getFailed('execute-agent')).rejects.toBeInstanceOf(NotFoundException);
  });
});
