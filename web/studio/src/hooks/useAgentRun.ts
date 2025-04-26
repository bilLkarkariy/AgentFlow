import { useCallback } from 'react';
import axios from 'axios';

interface AgentRunParams {
  prompt: string;
  model?: string;
  temperature?: number;
}

interface AgentRunResult {
  data?: any;
  error?: Error;
}

export function useAgentRun() {
  // use Vite environment variable under import.meta.env
  const base = import.meta.env.VITE_AGENT_RUNTIME_URL || 'http://localhost:8000';
  return useCallback(async ({ prompt, model, temperature }: AgentRunParams): Promise<AgentRunResult> => {
    try {
      const response = await axios.post(
        `${base}/run`,
        { prompt, parameters: { model, temperature } },
      );
      return { data: response.data, error: undefined };
    } catch (err: any) {
      return { data: undefined, error: err };
    }
  }, [base]);
}
