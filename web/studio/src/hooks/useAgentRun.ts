import { useCallback } from 'react';
import { runAgentFlowFn } from '../entities/agent/api';

interface AgentRunParams {
  agentId: string;
  prompt: string;
  model?: string;
  temperature?: number;
}

interface AgentRunResult {
  data?: any;
  error?: Error;
}

export function useAgentRun() {
  return useCallback(async ({ agentId, prompt, model, temperature }: AgentRunParams): Promise<AgentRunResult> => {
    try {
      const response = await runAgentFlowFn(agentId);
      return { data: response, error: undefined };
    } catch (err: any) {
      return { data: undefined, error: err };
    }
  }, []);
}
