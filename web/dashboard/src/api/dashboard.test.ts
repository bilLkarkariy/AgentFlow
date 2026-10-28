import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { getRoiStats } from './dashboard';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('axios', () => ({ default: { create: vi.fn(() => ({ get })) } }));

describe('getRoiStats', () => {
  it('targets the configured API base URL', () => {
    expect(axios.create).toHaveBeenCalledWith({ baseURL: 'http://localhost:3000' });
  });

  it('queries /dashboard/roi for the date range and returns the rows', async () => {
    const rows = [{ date: '2026-10-01', executionsCount: 3, timeSavedMinutes: 45 }];
    get.mockResolvedValueOnce({ data: rows });

    await expect(getRoiStats('2026-10-01', '2026-10-31')).resolves.toEqual(rows);
    expect(get).toHaveBeenCalledWith('/dashboard/roi', {
      params: { from: '2026-10-01', to: '2026-10-31' },
    });
  });
});
