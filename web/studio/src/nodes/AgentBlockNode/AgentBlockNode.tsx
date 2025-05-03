import React, { useState, useEffect, memo, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAgentRun } from '../../hooks/useAgentRun';
import { connectToRun, FlowLogEvent } from '../../features/flowLogs/socket';

export function AgentBlockNode({ id, data }: NodeProps<{ prompt: string; model?: string; temperature?: number }>) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<FlowLogEvent[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const runAgent = useAgentRun();

  const onSimulate = async () => {
    if (!data.prompt) {
      setError('Prompt is required');
      return;
    }
    setError(null);
    setLoading(true);
    setLogs([]);
    const { data: res, error: err } = await runAgent({
      agentId: id,
      prompt: data.prompt,
      model: data.model,
      temperature: data.temperature,
    });
    setLoading(false);
    // Save runId for log streaming if provided
    if ((res as any)?.runId) setRunId((res as any).runId);
    if (err) {
      setError(err.message);
    } else {
      setResult(res);
    }
  };

  // Subscribe to logs over WebSocket when a runId is set
  useEffect(() => {
    if (!runId) return;
    const socket = connectToRun(runId);
    socket.on('log', (evt: FlowLogEvent) => setLogs(prev => [...prev, evt]));
    return () => { socket.disconnect(); };
  }, [runId]);

  return (
    <div className="bg-white p-3 rounded shadow w-48">
      <Handle type="target" position={Position.Top} />
      <div className="flex flex-col space-y-2">
        <textarea
          className="border p-1 rounded w-full text-sm"
          placeholder="Enter prompt..."
          defaultValue={data.prompt}
          onChange={(e) => (data.prompt = e.target.value)}
        />
        <input
          className="border p-1 rounded w-full text-sm"
          placeholder="Model (e.g., o4-mini)"
          defaultValue={data.model}
          onChange={(e) => (data.model = e.target.value)}
        />
        <div className="flex items-center space-x-2">
          <label className="text-xs">Temperature:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            defaultValue={data.temperature ?? 0.7}
            onChange={(e) => (data.temperature = parseFloat(e.target.value))}
          />
          <span className="text-xs">{data.temperature ?? 0.7}</span>
        </div>
        <button
          disabled={loading}
          onClick={onSimulate}
          className="bg-blue-600 text-white py-1 px-2 rounded disabled:opacity-50"
        >
          {loading ? 'Simulating...' : 'Simulate'}
        </button>
        {error && <div className="text-red-600 text-xs">{error}</div>}
        {result && (
          <div className="text-green-700 text-xs whitespace-pre-wrap h-24 overflow-auto">
            {JSON.stringify(result, null, 2)}
          </div>
        )}
        {logs.length > 0 && (
          <div className="text-xs font-mono space-y-1 h-24 overflow-auto bg-gray-100 p-1 rounded">
            {logs.map((l, i) => (
              <div key={i}>{`${new Date(l.timestamp).toLocaleTimeString()}: ${l.message}`}</div>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(AgentBlockNode);
