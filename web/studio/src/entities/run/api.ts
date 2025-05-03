import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../shared/api/base';
import type { Run } from '../../shared/types/run';

// Paginated runs response
interface PaginatedRuns {
  items: Run[];
  total: number;
}

// Fetch list of runs with pagination
const getRuns = (page: number, limit: number): Promise<PaginatedRuns> =>
  api.get('/runs', { params: { page, limit } }).then(res => res.data);

// Fetch single run detail
const getRun = (runId: string): Promise<Run> =>
  api.get(`/runs/${runId}`).then(res => res.data);

export function useRuns(page: number = 1, limit: number = 10) {
  return useQuery<PaginatedRuns, Error>({
    queryKey: ['runs', page],
    queryFn: () => getRuns(page, limit),
  });
}

export function useRun(runId: string) {
  return useQuery<Run, Error>({
    queryKey: ['run', runId],
    queryFn: () => getRun(runId),
  });
}

// Trigger retry for a run
const retryRun = (runId: string): Promise<void> =>
  api.post(`/runs/${runId}/retry`).then(() => {});

export function useRetryRun() {
  return useMutation({
    mutationFn: (runId: string) => retryRun(runId),
  });
}

// Trigger cancel for a run
const cancelRun = (runId: string): Promise<void> =>
  api.post(`/runs/${runId}/cancel`).then(() => {});

export function useCancelRun() {
  return useMutation({
    mutationFn: (runId: string) => cancelRun(runId),
  });
}
