import create from 'zustand';
import axios from 'axios';

export interface HubspotTrigger {
  id: string;
  eventType: string;
  agent: { id: string };
}

interface TriggersState {
  triggers: HubspotTrigger[];
  fetchTriggers: (agentId: string) => Promise<void>;
  addTrigger: (agentId: string, eventType: string) => Promise<void>;
  deleteTrigger: (id: string, agentId: string) => Promise<void>;
}

export const useHubspotTriggersStore = create<TriggersState>((set, get) => ({
  triggers: [],
  fetchTriggers: async (agentId) => {
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/hubspot/triggers/${agentId}`);
    set({ triggers: res.data });
  },
  addTrigger: async (agentId, eventType) => {
    const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/hubspot/triggers`, {
      agentId,
      eventType,
    });
    set({ triggers: [...get().triggers, res.data] });
  },
  deleteTrigger: async (id, agentId) => {
    await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/api/hubspot/triggers/${id}`);
    await get().fetchTriggers(agentId);
  },
}));
