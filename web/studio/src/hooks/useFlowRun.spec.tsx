import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFlowRun } from './useFlowRun';
import { api } from '../shared/api/base';
import { connectToRun } from '../features/flowLogs/socket';
import { showToast } from '../components/shared/Toast';

jest.mock('../features/flowLogs/socket', () => ({ connectToRun: jest.fn() }));
jest.mock('../components/shared/Toast', () => ({ showToast: jest.fn() }));

const mockConnectToRun = connectToRun as jest.Mock;

function fakeSocket() {
  const handlers: Record<string, (payload?: unknown) => void> = {};
  return {
    handlers,
    on: jest.fn((event: string, cb: (payload?: unknown) => void) => {
      handlers[event] = cb;
    }),
    disconnect: jest.fn(),
  };
}

function renderFlowRun(agentId = 'agent-1') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFlowRun(agentId), { wrapper });
}

describe('useFlowRun', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockConnectToRun.mockReset();
    (showToast as jest.Mock).mockReset();
  });

  it('starts a run with the test message, then counts the tokens of its room', async () => {
    const post = jest.spyOn(api, 'post').mockResolvedValue({ data: { id: 'run-1', status: 'pending' } });
    const socket = fakeSocket();
    mockConnectToRun.mockReturnValue(socket);
    const { result } = renderFlowRun();

    await act(() => result.current.start('Bonjour'));

    expect(post).toHaveBeenCalledWith('/agents/agent-1/flow/runs', { input: 'Bonjour' });
    expect(result.current.runId).toBe('run-1');
    expect(mockConnectToRun).toHaveBeenCalledWith('run-1');

    act(() => {
      socket.handlers.tokens('Bon');
      socket.handlers.tokens('jour');
    });
    expect(result.current.progress).toBe(2);
  });

  it('leaves the previous room and restarts the count on a new run', async () => {
    jest
      .spyOn(api, 'post')
      .mockResolvedValueOnce({ data: { id: 'run-1', status: 'pending' } })
      .mockResolvedValueOnce({ data: { id: 'run-2', status: 'pending' } });
    const first = fakeSocket();
    const second = fakeSocket();
    mockConnectToRun.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { result } = renderFlowRun();

    await act(() => result.current.start('a'));
    act(() => first.handlers.tokens('x'));
    await act(() => result.current.start('b'));

    expect(first.disconnect).toHaveBeenCalled();
    expect(mockConnectToRun).toHaveBeenLastCalledWith('run-2');
    expect(result.current.runId).toBe('run-2');
    expect(result.current.progress).toBe(0);
  });

  it('shows an error toast when the run cannot be started', async () => {
    jest.spyOn(api, 'post').mockRejectedValue(new Error('Network Error'));
    const { result } = renderFlowRun();

    await act(() => result.current.start('Bonjour'));

    expect(showToast).toHaveBeenCalledWith('Erreur lancement exécution', 'error');
    expect(result.current.runId).toBeNull();
    expect(mockConnectToRun).not.toHaveBeenCalled();
  });
});
