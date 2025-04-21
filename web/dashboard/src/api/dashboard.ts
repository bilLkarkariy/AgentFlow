import axios from 'axios';
import type { RoiStat } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
});

export async function getRoiStats(from: string, to: string): Promise<RoiStat[]> {
  const response = await api.get<RoiStat[]>('/dashboard/roi', { params: { from, to } });
  return response.data;
}
