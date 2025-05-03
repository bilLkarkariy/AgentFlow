import { AgentController } from './agent.controller';
import { Queue } from 'bullmq';

describe('AgentController', () => {
  let controller: AgentController;
  let mockQueue: Partial<Queue>;

  beforeEach(() => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: '42' }),
    };
    controller = new AgentController(mockQueue as Queue);
  });

  it('should enqueue a job and return jobId', async () => {
    const dto = { flowId: 'flow', nodeId: 'node', input: { foo: 'bar' } };
    const result = await controller.run(dto);
    expect(mockQueue.add).toHaveBeenCalledWith('default', dto);
    expect(result).toEqual({ jobId: '42' });
  });
});
