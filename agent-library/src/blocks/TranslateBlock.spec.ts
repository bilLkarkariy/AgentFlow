import { TranslateBlock } from './TranslateBlock';
import { AgentRuntimeClient } from '../client/AgentRuntimeClient';

describe('TranslateBlock', () => {
  let agentRuntime: jest.Mocked<AgentRuntimeClient>;
  let block: TranslateBlock;

  beforeEach(() => {
    agentRuntime = { run: jest.fn().mockResolvedValue('{"translation":"mock translation"}') } as any;
    block = new TranslateBlock(agentRuntime);
  });

  it('should return the parsed translation object', async () => {
    const input = 'Bonjour le monde';
    const result = await block.run(input);

    expect(agentRuntime.run).toHaveBeenCalledWith({ prompt: expect.stringContaining(input) });
    expect(result).toEqual({ translation: 'mock translation' });
  });
});
