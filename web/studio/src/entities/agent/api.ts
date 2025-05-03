import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/base';
import type { Agent } from '../../shared/types/agent';
import type { FlowDto } from '../../shared/types/flow';

// Domain API
const getAgents = (): Promise<Agent[]> => api.get('/agents').then(res => res.data);
const createAgentFn = (name: string): Promise<Agent> => api.post('/agents', { name }).then(res => res.data);
const getAgentFlowFn = (agentId: string): Promise<FlowDto> => api.get(`/agents/${agentId}/flow`).then(res => res.data);
const saveAgentFlowFn = (params: { agentId: string; flow: FlowDto }): Promise<void> =>
  api.put(`/agents/${params.agentId}/flow`, params.flow).then(() => {});
export const runAgentFlowFn = (agentId: string): Promise<{ status: string; runId: string }> => api.post(`/agents/${agentId}/flow/execute`).then(res => res.data);

// React Query hooks
export function useAgents() {
  return useQuery<Agent[], Error>({
    queryKey: ['agents'],
    queryFn: getAgents,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation<Agent, Error, string>({
    mutationFn: createAgentFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useAgentFlow(agentId: string) {
  return useQuery<FlowDto, Error>({
    queryKey: ['agentFlow', agentId],
    queryFn: () => getAgentFlowFn(agentId),
  });
}

export function useSaveAgentFlow(agentId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, FlowDto>({
    mutationFn: (flow) => saveAgentFlowFn({ agentId, flow }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agentFlow', agentId] }),
  });
}

export function useRunAgentFlow() {
  const qc = useQueryClient();
  return useMutation<{ status: string; runId: string }, Error, string>({
    mutationFn: runAgentFlowFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runs'] }),
  });
}
