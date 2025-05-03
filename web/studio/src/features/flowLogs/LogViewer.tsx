import React, { useEffect, useRef } from 'react';
import LogLine from './LogLine';
import { useRunLogs } from '../../entities/run/hooks';

interface Props {
  runId: string;
  searchTerm?: string;
  levelFilter?: 'all' | 'info' | 'success' | 'error';
}

const LogViewer: React.FC<Props> = ({ runId, searchTerm = '', levelFilter = 'all' }) => {
  const logs = useRunLogs(runId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Apply filters
  const filteredLogs = logs.filter(l =>
    (levelFilter === 'all' || l.status === levelFilter) &&
    l.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-black text-sm p-4 h-96 overflow-y-auto rounded">
      {logs.length === 0 ? (
        <p className="text-neutral-400">En attente de logs...</p>
      ) : (
        <ul className="font-mono space-y-1">
          {filteredLogs.map((l, i) => (
            <LogLine key={i} log={l} />
          ))}
          {filteredLogs.length === 0 && <p className="text-neutral-500">Aucun log correspondant.</p>}
        </ul>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default LogViewer;
