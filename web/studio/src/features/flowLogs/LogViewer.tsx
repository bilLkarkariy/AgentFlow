import React, { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { connectToRun, FlowLogEvent } from './socket';
import LogLine from './LogLine';

interface Props {
  runId: string;
}

const LogViewer: React.FC<Props> = ({ runId }) => {
  const [logs, setLogs] = useState<FlowLogEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = connectToRun(runId);
    socketRef.current = socket;

    socket.on('log', (evt: FlowLogEvent) => {
      if (evt.runId !== runId) return;
      setLogs((prev) => [...prev, evt]);
    });

    return () => {
      socket.disconnect();
    };
  }, [runId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-black text-sm p-4 h-96 overflow-y-auto rounded">
      {logs.length === 0 ? (
        <p className="text-neutral-400">En attente de logs...</p>
      ) : (
        <ul className="font-mono space-y-1">
          {logs.map((l, i) => (
            <LogLine key={i} log={l} />
          ))}
        </ul>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default LogViewer;
