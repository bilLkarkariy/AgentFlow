import { useEffect } from 'react';

export interface HubspotCredentials {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string;
  agent: { id: string };
}

export interface HubspotStore {
  credentials?: HubspotCredentials;
  fetchCredentials: (agentId: string) => void;
  removeCredentials: (agentId: string) => void;
}

export function useHubspotStore(agentId?: string): HubspotStore {
  useEffect(() => {
    if (agentId) {
      // Placeholder: fetch credentials for the agent
    }
  }, [agentId]);

  return {
    credentials: undefined,
    fetchCredentials: () => {},
    removeCredentials: () => {},
  };
}
