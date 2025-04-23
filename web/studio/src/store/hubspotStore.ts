import create from 'zustand';
import axios from 'axios';

interface HubspotCredential {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string;
  agent: { id: string };
}

type HubspotState = {
  credentials?: HubspotCredential;
  fetchCredentials: (agentId: string) => Promise<void>;
  removeCredentials: (agentId: string) => Promise<void>;
};

export const useHubspotStore = create<HubspotState>((set) => ({
  credentials: undefined,
  fetchCredentials: async (agentId) => {
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/hubspot/credentials/${agentId}`);
    set({ credentials: res.data });
  },
  removeCredentials: async (agentId) => {
    await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/api/hubspot/credentials/${agentId}`);
    set({ credentials: undefined });
  },
}));
