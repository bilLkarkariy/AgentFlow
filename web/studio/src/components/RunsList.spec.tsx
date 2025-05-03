import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import RunsList from './RunsList';

describe('RunsList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    jest.restoreAllMocks();
  });

  it('shows loading state', () => {
    jest.spyOn(axios, 'get').mockImplementation(() => new Promise(() => {}));
    render(
      <QueryClientProvider client={queryClient}>
        <RunsList agentId="agent1" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Loading runs.../i)).toBeInTheDocument();
  });

  it('renders runs after fetch', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data: [{ id: 'r1', status: 'success' }] });
    render(
      <QueryClientProvider client={queryClient}>
        <RunsList agentId="agent1" />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText('Last runs')).toBeInTheDocument());
    expect(screen.getByText('r1 - success')).toBeInTheDocument();
  });

  it('shows error on fetch failure', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('fail'));
    render(
      <QueryClientProvider client={queryClient}>
        <RunsList agentId="agent1" />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText(/Error loading runs/i)).toBeInTheDocument());
  });
});
