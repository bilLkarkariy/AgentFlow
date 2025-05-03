import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../../shared/lib/env';

export interface FlowLogEvent {
  runId: string;
  nodeId: string;
  status: 'success' | 'error' | 'info';
  timestamp: number;
  message: string;
}

export const connectToRun = (
  runId: string,
  base = API_BASE_URL,
): Socket => {
  const socket = io(`${base}/ws/flow`, { transports: ['websocket'] });
  socket.on('connect', () => {
    socket.emit('join', { runId });
  });
  return socket;
};
