import { FlowController } from './flow.controller';
import { FlowService } from './flow.service';
import { Queue } from 'bullmq';

describe('FlowController', () => {
  let controller: FlowController;
  let mockQueue: Partial<Queue>;
  let mockService: Partial<FlowService>;

  beforeEach(() => {
    mockQueue = { add: jest.fn().mockResolvedValue({ id: 'run-1' }) };
    mockService = {};
    controller = new FlowController(mockService as FlowService, mockQueue as Queue);
  });

  it('should queue execution and return runId', async () => {
    const result = await controller.execute('agent1');
    expect(mockQueue.add).toHaveBeenCalledWith('execute-agent', { agentId: 'agent1' });
    expect(result).toEqual({ status: 'queued', runId: 'run-1' });
  });
});
