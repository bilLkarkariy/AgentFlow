import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import LogsTimeline from './LogsTimeline';
import { connectToRun } from '../features/flowLogs/socket';

jest.mock('../features/flowLogs/socket');

interface HandlerMap {
  [event: string]: (ev: any) => void;
}

const mockHandlers: HandlerMap = {};

const fakeSocket = {
  on: (event: string, cb: (ev: any) => void) => {
    mockHandlers[event] = cb;
  },
  disconnect: jest.fn(),
};

;(connectToRun as jest.Mock).mockReturnValue(fakeSocket);

describe('LogsTimeline', () => {
  const runId = 'test-run';

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockHandlers).forEach((k) => delete mockHandlers[k]);
  });

  it('renders log events', () => {
    render(<LogsTimeline runId={runId} />);
    act(() => {
      mockHandlers['flowLog']({
        runId,
        nodeId: 'node1',
        status: 'success',
        timestamp: 1234567890,
        message: 'Test message',
      });
    });
    expect(screen.getByText(/Test message/)).toBeInTheDocument();
  });

  it('auto-scrolls on new events', () => {
    const { getByTestId } = render(<LogsTimeline runId={runId} />);
    const container = getByTestId('logs-content');
    // stub scrollHeight
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true });
    act(() => {
      mockHandlers['flowLog']({
        runId,
        nodeId: 'node-scroll',
        status: 'info',
        timestamp: Date.now(),
        message: 'Scroll now',
      });
    });
    expect(container.scrollTop).toBe(500);
  });

  it('toggles collapse/expand', () => {
    render(<LogsTimeline runId={runId} />);
    const toggle = screen.getByTestId('toggle-logs');
    // initially expanded
    expect(screen.getByTestId('logs-content')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByTestId('logs-content')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('logs-content')).toBeInTheDocument();
  });
});
