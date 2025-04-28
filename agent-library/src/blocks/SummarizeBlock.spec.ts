import { SummarizeBlock } from './SummarizeBlock';
import { AgentRuntimeClient } from '../client/AgentRuntimeClient';

describe('SummarizeBlock', () => {
  let agentRuntime: jest.Mocked<AgentRuntimeClient>;
  let block: SummarizeBlock;

  beforeEach(() => {
    agentRuntime = {
      run: jest.fn().mockResolvedValue('{"summary":"mock summary"}')
    } as any;
    block = new SummarizeBlock(agentRuntime);
  });

  it('should return the parsed summary object', async () => {
    const input = 'some long text that will be summarized by the model';
    const result = await block.run(input);

    // Verify AgentRuntimeClient call
    expect(agentRuntime.run).toHaveBeenCalledWith({ prompt: expect.stringContaining(input) });

    // Verify returned value matches schema
    expect(result).toEqual({ summary: 'mock summary' });
  });
});
