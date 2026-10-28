import { api } from '../../shared/api/base';
import { runAgentFlowFn } from './api';

describe('runAgentFlowFn', () => {
  afterEach(() => jest.restoreAllMocks());

  it('starts an asynchronous run of the flow and returns its id as runId', async () => {
    const post = jest
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { id: 'run-1', status: 'pending', stats: null } });

    await expect(runAgentFlowFn('agent-1', 'Bonjour')).resolves.toEqual({ runId: 'run-1', status: 'pending' });
    expect(post).toHaveBeenCalledWith('/agents/agent-1/flow/runs', { input: 'Bonjour' });
  });

  it('sends an empty input when none is given', async () => {
    const post = jest.spyOn(api, 'post').mockResolvedValue({ data: { id: 'run-2', status: 'pending' } });

    await runAgentFlowFn('agent-1');
    expect(post).toHaveBeenCalledWith('/agents/agent-1/flow/runs', { input: '' });
  });
});
