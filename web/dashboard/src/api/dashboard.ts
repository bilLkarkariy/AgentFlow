import axios from 'axios';
import type { RoiStat } from '../types';
import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export async function getRoiStats(from: string, to: string): Promise<RoiStat[]> {
  const response = await api.get<RoiStat[]>('/dashboard/roi', { params: { from, to } });
  return response.data;
}
