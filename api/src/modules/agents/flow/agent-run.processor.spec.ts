import { NotFoundException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { register } from 'prom-client';
import { of, throwError } from 'rxjs';
import { AgentRunProcessor } from './agent-run.processor';

describe('AgentRunProcessor', () => {
  let processor: AgentRunProcessor;
  let mockFlows: any;
  let mockEngine: any;
  let mockRepo: any;
  let mockGateway: any;
  const flow = { nodes: [{ id: 'n1' }], edges: [], mappings: [] };
  const job: any = { id: '123', data: { agentId: 'agent-1', input: 'hello' } };

  beforeEach(() => {
    mockFlows = { getDto: jest.fn().mockResolvedValue(flow) };
    mockEngine = { runFlow: jest.fn().mockReturnValue(of('chunk1', 'chunk2')) };
    mockRepo = { save: jest.fn().mockResolvedValue(undefined) };
    mockGateway = { server: { to: jest.fn().mockReturnThis(), emit: jest.fn() } };
    processor = new AgentRunProcessor(mockFlows, mockEngine, mockRepo, mockGateway);
  });

  it('should process job, emit logs and save run', async () => {
    await processor.process(job);

    // Start log
    expect(mockGateway.server.to).toHaveBeenCalledWith('123');
    expect(mockGateway.server.emit).toHaveBeenCalledWith(
      'log',
      expect.objectContaining({ message: 'Agent run start' }),
    );

    // The stored flow of the agent is what runs
    expect(mockFlows.getDto).toHaveBeenCalledWith('agent-1');
    expect(mockEngine.runFlow).toHaveBeenCalledWith(flow, 'hello');

    // Chunk logs
    expect(mockGateway.server.emit).toHaveBeenCalledWith(
      'log',
      expect.objectContaining({ message: 'chunk1' }),
    );
    expect(mockGateway.server.emit).toHaveBeenCalledWith(
      'log',
      expect.objectContaining({ message: 'chunk2' }),
    );

    // Save run
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionItemId: '123' }),
    );

    // Complete log
    expect(mockGateway.server.emit).toHaveBeenCalledWith(
      'log',
      expect.objectContaining({ message: 'Agent run complete' }),
    );
  });

  it('rethrows a failed run so BullMQ retries it, and saves nothing', async () => {
    const failure = new Error('Agent runner timeout after 30000ms');
    mockEngine.runFlow.mockReturnValue(throwError(() => failure));

    await expect(processor.process(job)).rejects.toBe(failure);
    expect(failure).not.toBeInstanceOf(UnrecoverableError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('does not retry an unknown agent or an agent without a flow', async () => {
    mockFlows.getDto.mockRejectedValueOnce(new NotFoundException('Agent not found'));
    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);

    mockFlows.getDto.mockResolvedValueOnce({ nodes: [], edges: [], mappings: [] });
    await expect(processor.process(job)).rejects.toThrow('Agent agent-1 has no flow to run');
    expect(mockEngine.runFlow).not.toHaveBeenCalled();
  });

  it('registers no legacy per-job metric (they live in AgentPythonClientService)', () => {
    const legacy = register
      .getMetricsAsArray()
      .filter(metric => /^agent_/.test(metric.name));
    expect(legacy).toHaveLength(0);
  });
});
