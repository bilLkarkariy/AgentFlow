import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { getRoiStats } from '../api/dashboard';
import type { RoiStat } from '../types';

vi.mock('../api/dashboard', () => ({ getRoiStats: vi.fn() }));

// Chart.js needs a real canvas; the page logic is what is under test here.
vi.mock('../components/RoiChart', () => ({
  default: ({ data }: { data: RoiStat[] }) => (
    <div data-testid="roi-chart">{data.length} points</div>
  ),
}));

const fetchStats = vi.mocked(getRoiStats);

describe('Dashboard page', () => {
  beforeEach(() => {
    fetchStats.mockReset();
  });

  it("loads today's stats on mount and draws the chart", async () => {
    fetchStats.mockResolvedValueOnce([
      { date: '2026-10-27', executionsCount: 4, timeSavedMinutes: 60 },
      { date: '2026-10-28', executionsCount: 2, timeSavedMinutes: 25 },
    ]);
    const today = new Date().toISOString().slice(0, 10);

    render(<Dashboard />);

    expect(await screen.findByTestId('roi-chart')).toHaveTextContent('2 points');
    expect(fetchStats).toHaveBeenCalledWith(today, today);
  });

  it('says so when the period has no data', async () => {
    fetchStats.mockResolvedValueOnce([]);

    render(<Dashboard />);

    expect(await screen.findByText('Aucune donnée pour cette période.')).toBeInTheDocument();
    expect(screen.queryByTestId('roi-chart')).not.toBeInTheDocument();
  });

  it('shows the error when the API call fails', async () => {
    fetchStats.mockRejectedValueOnce(new Error('Network Error'));

    render(<Dashboard />);

    expect(await screen.findByText('Network Error')).toBeInTheDocument();
    expect(screen.queryByTestId('roi-chart')).not.toBeInTheDocument();
  });
});
