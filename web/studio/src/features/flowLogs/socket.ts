import { io, Socket } from 'socket.io-client';

export interface FlowLogEvent {
  runId: string;
  nodeId: string;
  status: 'success' | 'error' | 'info';
  timestamp: number;
  message: string;
}

export const connectToRun = (
  runId: string,
  base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
): Socket => {
  const socket = io(`${base}/ws/flow`, { transports: ['websocket'] });
  socket.on('connect', () => {
    socket.emit('join', { runId });
  });
  return socket;
};
