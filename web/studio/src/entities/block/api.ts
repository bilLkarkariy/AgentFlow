import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/base';
import type { Block } from '../../shared/types/block';

// Fetch all available blocks
const getBlocks = (): Promise<Block[]> => api.get('/blocks').then(res => res.data);
// Fetch single block details
const getBlock = (id: string): Promise<Block> => api.get(`/blocks/${id}`).then(res => res.data);
// Install block into workspace
const installBlock = (id: string): Promise<void> => api.post(`/blocks/${id}/install`).then(() => {});

export function useBlocks() {
  return useQuery<Block[], Error>({ queryKey: ['blocks'], queryFn: getBlocks });
}

export function useBlock(id: string) {
  return useQuery<Block, Error>({ queryKey: ['block', id], queryFn: () => getBlock(id) });
}

export function useInstallBlock() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: installBlock,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });
}
