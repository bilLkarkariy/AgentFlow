import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/base';
import type { HubspotCredential, HubspotTrigger } from '../../shared/types/hubspot';

// Endpoints
const getAuthorizeUrl = (agentId: string): Promise<{ url: string }> =>
  api.get(`/api/hubspot/authorize/${agentId}`).then(res => res.data);
const fetchCredentials = (agentId: string): Promise<HubspotCredential> =>
  api.get(`/api/hubspot/credentials/${agentId}`).then(res => res.data);
const removeCredentialsFn = (agentId: string): Promise<void> =>
  api.delete(`/api/hubspot/credentials/${agentId}`).then(() => {});
const fetchTriggersFn = (agentId: string): Promise<HubspotTrigger[]> =>
  api.get(`/api/hubspot/triggers/${agentId}`).then(res => res.data);
const addTriggerFn = (params: { agentId: string; eventType: string }): Promise<HubspotTrigger> =>
  api.post(`/api/hubspot/triggers`, params).then(res => res.data);
const deleteTriggerFn = (triggerId: string): Promise<void> =>
  api.delete(`/api/hubspot/triggers/${triggerId}`).then(() => {});

// Hooks
export function useHubspotAuthorize() {
  return useMutation<{ url: string }, Error, string>({
    mutationFn: getAuthorizeUrl,
  });
}

export function useHubspotCredentials(agentId: string) {
  return useQuery<HubspotCredential, Error>({
    queryKey: ['hubspotCredential', agentId],
    queryFn: () => fetchCredentials(agentId),
  });
}

export function useRemoveHubspotCredentials() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: removeCredentialsFn,
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['hubspotCredential', variables] }),
  });
}

export function useHubspotTriggers(agentId: string) {
  return useQuery<HubspotTrigger[], Error>({
    queryKey: ['hubspotTriggers', agentId],
    queryFn: () => fetchTriggersFn(agentId),
  });
}

export function useAddHubspotTrigger(agentId: string) {
  const qc = useQueryClient();
  return useMutation<HubspotTrigger, Error, string>({
    mutationFn: (eventType: string) => addTriggerFn({ agentId, eventType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hubspotTriggers', agentId] }),
  });
}

export function useDeleteHubspotTrigger(agentId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteTriggerFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hubspotTriggers', agentId] }),
  });
}
