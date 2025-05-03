import { useState, useEffect } from 'react';
import { connectToRun, FlowLogEvent } from '../../features/flowLogs/socket';

/**
 * Hook to subscribe to real-time run logs via WebSocket
 */
export function useRunLogs(runId: string): FlowLogEvent[] {
  const [logs, setLogs] = useState<FlowLogEvent[]>([]);

  useEffect(() => {
    const socket = connectToRun(runId);
    socket.on('log', (evt: FlowLogEvent) => {
      if (evt.runId !== runId) return;
      setLogs(prev => [...prev, evt]);
    });
    return () => {
      socket.disconnect();
    };
  }, [runId]);

  return logs;
}
