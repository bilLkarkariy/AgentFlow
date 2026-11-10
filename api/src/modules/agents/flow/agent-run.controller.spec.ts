import { AgentRunController } from './agent-run.controller';
import { Queue } from 'bullmq';

describe('AgentRunController', () => {
  let controller: AgentRunController;
  let mockQueue: Partial<Queue>;

  beforeEach(() => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: '42' }),
    };
    controller = new AgentRunController(mockQueue as Queue);
  });

  it('should enqueue a job and return jobId', async () => {
    const dto = { agentId: 'agent-1', input: 'hello' };
    const result = await controller.run(dto);
    expect(mockQueue.add).toHaveBeenCalledWith('default', dto);
    expect(result).toEqual({ jobId: '42' });
  });
});
