import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AgentBlockNode from './AgentBlockNode';
import { useAgentRun } from '../../hooks/useAgentRun';
import { ReactFlowProvider } from 'reactflow';
import { connectToRun } from '../../features/flowLogs/socket';

jest.mock('../../hooks/useAgentRun');
jest.mock('../../features/flowLogs/socket', () => ({
  connectToRun: jest.fn(),
}));

const mockUseAgentRun = useAgentRun as jest.Mock;
const mockConnectToRun = connectToRun as jest.Mock;

const defaultProps: any = {
  id: '1',
  type: 'agent',
  data: {},
  selected: false,
  zIndex: 0,
  isConnectable: false,
  xPos: 0,
  yPos: 0,
};

// Helper to wrap node in React Flow context provider
const renderWithProvider = (ui: React.ReactElement) =>
  render(<ReactFlowProvider>{ui}</ReactFlowProvider>);

describe('AgentBlockNode', () => {
  beforeEach(() => {
    mockUseAgentRun.mockReset();
    mockConnectToRun.mockReset();
  });

  it('enables Simulate button when prompt is empty', () => {
    mockUseAgentRun.mockReturnValue(jest.fn());
    renderWithProvider(<AgentBlockNode {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /simulate/i });
    expect(btn).toBeEnabled();
  });

  it('shows error message on empty prompt simulate', async () => {
    mockUseAgentRun.mockReturnValue(jest.fn());
    renderWithProvider(<AgentBlockNode {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /simulate/i });
    fireEvent.click(btn);
    await waitFor(() => screen.getByText(/Prompt is required/i));
    expect(screen.getByText(/Prompt is required/i)).toBeInTheDocument();
  });

  it('renders result on successful run', async () => {
    const mockRun = jest.fn().mockResolvedValue({ data: { text: 'OK' }, error: undefined });
    mockUseAgentRun.mockReturnValue(mockRun);
    const data = { prompt: 'hello' };
    renderWithProvider(<AgentBlockNode {...defaultProps} data={data} />);
    const btn = screen.getByRole('button', { name: /simulate/i });
    fireEvent.click(btn);
    await waitFor(() => expect(mockRun).toHaveBeenCalledWith({ prompt: 'hello', model: undefined, temperature: undefined }));
    await waitFor(() => screen.getByText(/OK/));
    expect(screen.getByText(/OK/)).toBeInTheDocument();
  });

  it('shows error on failed run', async () => {
    const mockRun = jest.fn().mockResolvedValue({ data: undefined, error: new Error('fail') });
    mockUseAgentRun.mockReturnValue(mockRun);
    const data = { prompt: 'hi' };
    renderWithProvider(<AgentBlockNode {...defaultProps} data={data} />);
    const btn = screen.getByRole('button', { name: /simulate/i });
    fireEvent.click(btn);
    await waitFor(() => screen.getByText(/fail/));
    expect(screen.getByText(/fail/)).toBeInTheDocument();
  });

  it('subscribes to WebSocket and displays logs', async () => {
    const mockRun = jest.fn().mockResolvedValue({ data: { text: 'OK', runId: 'run-123' }, error: undefined });
    mockUseAgentRun.mockReturnValue(mockRun);

    const logEvent = { timestamp: Date.now(), message: 'Streaming log' };
    const mockOn = jest.fn().mockImplementation((event, cb) => { if (event === 'log') cb(logEvent); });
    const mockDisconnect = jest.fn();
    mockConnectToRun.mockReturnValue({ on: mockOn, disconnect: mockDisconnect });

    const data = { prompt: 'hi' };
    renderWithProvider(<AgentBlockNode {...defaultProps} data={data} />);
    const btn = screen.getByRole('button', { name: /simulate/i });
    fireEvent.click(btn);

    await waitFor(() => expect(mockRun).toHaveBeenCalledWith({ prompt: 'hi', model: undefined, temperature: undefined }));
    await waitFor(() => screen.getByText(/Streaming log/));
    expect(screen.getByText(/Streaming log/)).toBeInTheDocument();
  });
});
