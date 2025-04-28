import { AgentRunProcessor } from './agent-run.processor';

describe('AgentRunProcessor', () => {
  let processor: AgentRunProcessor;
  let mockRuntime: any;
  let mockRepo: any;
  let mockGateway: any;

  beforeEach(() => {
    mockRuntime = { run: jest.fn().mockResolvedValue(['chunk1', 'chunk2']) };
    mockRepo = { save: jest.fn().mockResolvedValue(undefined) };
    mockGateway = { server: { to: jest.fn().mockReturnThis(), emit: jest.fn() } };
    processor = new AgentRunProcessor(mockRuntime, mockRepo, mockGateway);
  });

  it('should process job, emit logs and save run', async () => {
    const job: any = { id: '123', data: { flowId: 'flow', nodeId: 'node', input: { foo: 'bar' } } };

    await processor.process(job);

    // Start log
    expect(mockGateway.server.to).toHaveBeenCalledWith('123');
    expect(mockGateway.server.emit).toHaveBeenCalledWith(
      'log',
      expect.objectContaining({ message: 'Agent run start' }),
    );

    // Chunk logs
    expect(mockRuntime.run).toHaveBeenCalledWith('flow', { foo: 'bar' });
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
});
