import { useCallback, useEffect, useState } from 'react';
import { useRunAgentFlow } from '../entities/agent/api';
import { connectToRun } from '../features/flowLogs/socket';
import { showToast } from '../components/shared/Toast';

/**
 * Runs the saved flow of an agent from the designer: starts the run, then
 * counts the tokens it streams to its room on the /ws/flow socket.
 */
export function useFlowRun(agentId?: string) {
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { mutateAsync } = useRunAgentFlow();

  const start = useCallback(
    async (input: string) => {
      if (!agentId) return;
      try {
        const res = await mutateAsync({ agentId, input });
        setProgress(0);
        setRunId(res.runId);
      } catch {
        showToast('Erreur lancement exécution', 'error');
      }
    },
    [agentId, mutateAsync],
  );

  useEffect(() => {
    if (!runId) return;
    const socket = connectToRun(runId);
    socket.on('tokens', () => setProgress((p) => p + 1));
    return () => {
      socket.disconnect();
    };
  }, [runId]);

  return { runId, progress, start };
}
