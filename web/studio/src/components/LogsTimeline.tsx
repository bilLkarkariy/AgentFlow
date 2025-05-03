import React, { useEffect, useRef, useState } from 'react';
import { FlowLogEvent, connectToRun } from '../features/flowLogs/socket';

interface LogsTimelineProps {
  runId: string;
}

const LogsTimeline: React.FC<LogsTimelineProps> = ({ runId }) => {
  const [events, setEvents] = useState<FlowLogEvent[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!runId) return;
    const socket = connectToRun(runId);
    socket.on('flowLog', (ev: FlowLogEvent) => {
      setEvents((prev) => [...prev, ev]);
    });
    return () => {
      socket.disconnect();
    };
  }, [runId]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="flex flex-col h-full border-t">
      <div className="flex justify-between items-center px-2 py-1 bg-gray-200">
        <span className="font-semibold">Logs</span>
        <button
          data-testid="toggle-logs"
          className="text-sm text-blue-600"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!collapsed && (
        <div ref={containerRef} data-testid="logs-content" className="flex-1 overflow-auto space-y-1">
          {events.map((ev, idx) => (
            <div
              key={idx}
              className={`px-2 py-1 rounded text-sm ${
                ev.status === 'success'
                  ? 'bg-green-100 text-green-800'
                  : ev.status === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <span className="font-mono">{new Date(ev.timestamp).toLocaleTimeString()}</span>{' '}
              <span className="font-semibold">{ev.nodeId}</span>: {ev.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LogsTimeline;
