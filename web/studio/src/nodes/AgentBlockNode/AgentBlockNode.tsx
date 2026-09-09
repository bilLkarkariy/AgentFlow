import React, { useState, useEffect, memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CpuChipIcon, WrenchScrewdriverIcon, PlayIcon } from '@heroicons/react/24/outline';
import { useAgentRun } from '../../hooks/useAgentRun';
import { connectToRun, FlowLogEvent } from '../../features/flowLogs/socket';

type AgentData = {
  label?: string;
  name?: string;
  prompt?: string;
  instructions?: string;
  model?: string;
  temperature?: number;
  tool?: string;
};

export function AgentBlockNode({ id, data, selected }: NodeProps<AgentData>) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<FlowLogEvent[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const runAgent = useAgentRun();

  const titre = data.label || data.name || 'Agent';
  const consigne = data.prompt ?? data.instructions ?? '';
  const estOutil = Boolean(data.tool);

  const onSimulate = async () => {
    const prompt = data.prompt ?? data.instructions;
    if (!prompt) {
      setError('Ce bloc n’a pas de consigne. Ajoutez-en une pour le simuler.');
      return;
    }
    setError(null);
    setLoading(true);
    setLogs([]);
    const { data: res, error: err } = await runAgent({
      agentId: id,
      prompt,
      model: data.model,
      temperature: data.temperature,
    });
    setLoading(false);
    if ((res as any)?.runId) setRunId((res as any).runId);
    if (err) setError(err.message);
    else setResult(res);
  };

  useEffect(() => {
    if (!runId) return;
    const socket = connectToRun(runId);
    socket.on('log', (evt: FlowLogEvent) => setLogs((prev) => [...prev, evt]));
    return () => { socket.disconnect(); };
  }, [runId]);

  const Icone = estOutil ? WrenchScrewdriverIcon : CpuChipIcon;

  return (
    <div
      className={[
        'relative w-[236px] rounded-xl bg-white overflow-hidden border transition-all duration-150',
        selected
          ? 'border-agent shadow-lg shadow-agent/10'
          : 'border-line shadow-sm hover:shadow-md hover:border-inkmute/25',
      ].join(' ')}
    >
      {/* Arête de couleur : bleu pour un agent, ocre pour un outil sortant. */}
      <span
        className={['absolute left-0 top-0 bottom-0 w-[3px]', estOutil ? 'bg-tool' : 'bg-agent'].join(' ')}
      />

      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-white !border-2 !border-line" />

      <div className="flex items-center gap-2 pl-4 pr-3 py-2.5 border-b border-line/70">
        <Icone
          className={['w-[15px] h-[15px] shrink-0', estOutil ? 'text-tool' : 'text-agent'].join(' ')}
          strokeWidth={1.8}
        />
        <div className="text-[13px] font-semibold text-ink leading-tight truncate">{titre}</div>
        <span className="ml-auto label shrink-0">{estOutil ? 'Outil' : 'Agent'}</span>
      </div>

      <div className="pl-4 pr-3 py-2.5 space-y-2.5">
        {estOutil ? (
          <div className="measure bg-canvas rounded px-2 py-1.5 break-all">{data.tool}</div>
        ) : (
          <>
            <p className="text-[11.5px] leading-[1.45] text-inkmute line-clamp-3">
              {consigne || 'Aucune consigne.'}
            </p>

            {/* Plaque de caractéristiques : tout ce que la machine porte, en monospace. */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="measure bg-canvas rounded px-1.5 py-0.5 truncate">
                {data.model ?? 'gpt-4o-mini'}
              </span>
              <span className="measure shrink-0">t {data.temperature ?? 0.7}</span>
            </div>

            <button
              disabled={loading}
              onClick={onSimulate}
              className="w-full flex items-center justify-center gap-1.5 text-[11.5px] font-medium h-7 rounded-md border border-line text-inkmute hover:text-ink hover:bg-canvas disabled:opacity-50 transition-colors"
            >
              <PlayIcon className="w-3.5 h-3.5" strokeWidth={1.9} />
              {loading ? 'Simulation…' : 'Simuler ce bloc'}
            </button>
          </>
        )}

        {error && <div className="text-[11px] leading-snug text-tool">{error}</div>}
        {result && (
          <pre className="measure whitespace-pre-wrap max-h-20 overflow-auto bg-canvas rounded p-1.5">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
        {logs.length > 0 && (
          <div className="space-y-0.5 max-h-20 overflow-auto bg-canvas rounded p-1.5">
            {logs.map((l, i) => (
              <div key={i} className="measure">
                {`${new Date(l.timestamp).toLocaleTimeString()} ${l.message}`}
              </div>
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-white !border-2 !border-line" />
    </div>
  );
}

export default memo(AgentBlockNode);
