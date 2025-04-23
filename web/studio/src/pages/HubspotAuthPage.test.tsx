/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import { useHubspotStore } from '../store/hubspotStore';
import HubspotAuthPage from './HubspotAuthPage';

jest.mock('axios');
jest.mock('../store/hubspotStore', () => ({
  useHubspotStore: jest.fn(),
}));

describe('HubspotAuthPage', () => {
  const agentId = 'agent-1';
  const useHubspotStoreMock = useHubspotStore as unknown as jest.Mock;
  let fetchCredentials: jest.Mock;
  let removeCredentials: jest.Mock;

  beforeEach(() => {
    fetchCredentials = jest.fn();
    removeCredentials = jest.fn();
    useHubspotStoreMock.mockReturnValue({
      credentials: undefined,
      fetchCredentials,
      removeCredentials,
    });
    // override window.location.href
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  it('renders Connect button and redirects on click', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { url: 'http://auth-url' } });
    render(
      <MemoryRouter initialEntries={[`/agents/${agentId}/hubspot`]}>
        <Routes>
          <Route path="/agents/:agentId/hubspot" element={<HubspotAuthPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(fetchCredentials).toHaveBeenCalledWith(agentId);
    const btn = await screen.findByText(/Connect to HubSpot/i);
    fireEvent.click(btn);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining(`/api/hubspot/authorize/${agentId}`)
    );
    expect(window.location.href).toBe('http://auth-url');
  });

  it('renders Disconnect button when connected and calls removeCredentials', async () => {
    const now = new Date().toISOString();
    useHubspotStoreMock.mockReturnValue({
      credentials: { id: '1', accessToken: '', refreshToken: '', expiresAt: now, scope: '', agent: { id: agentId } },
      fetchCredentials,
      removeCredentials,
    });
    render(
      <MemoryRouter initialEntries={[`/agents/${agentId}/hubspot`]}>
        <Routes>
          <Route path="/agents/:agentId/hubspot" element={<HubspotAuthPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/Connected\./i)).toBeInTheDocument();
    const btn = screen.getByText(/Disconnect/i);
    fireEvent.click(btn);
    expect(removeCredentials).toHaveBeenCalledWith(agentId);
  });
});
