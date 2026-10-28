import { afterEach, describe, expect, it, vi } from 'vitest';

// config.ts resolves its values once, at import time.
async function loadConfig() {
  vi.resetModules();
  return import('./config');
}

describe('config', () => {
  afterEach(() => {
    delete window.__APP_CONFIG__;
    vi.unstubAllEnvs();
  });

  it('prefers the runtime values injected by /config.js', async () => {
    window.__APP_CONFIG__ = { API_BASE_URL: 'https://api.example.test' };
    vi.stubEnv('VITE_API_BASE_URL', 'http://build-time.example.test');

    const { API_BASE_URL } = await loadConfig();

    expect(API_BASE_URL).toBe('https://api.example.test');
  });

  it('falls back to the VITE_* build-time variables', async () => {
    window.__APP_CONFIG__ = {};
    vi.stubEnv('VITE_RABBITMQ_MGMT_URL', 'http://rabbitmq.example.test');

    const { RABBITMQ_MGMT_URL } = await loadConfig();

    expect(RABBITMQ_MGMT_URL).toBe('http://rabbitmq.example.test');
  });

  it('uses the local development defaults otherwise', async () => {
    const config = await loadConfig();

    expect(config.API_BASE_URL).toBe('http://localhost:3000');
    expect(config.RABBITMQ_MGMT_URL).toBe('http://localhost:15672');
    expect(config.DLQ_QUEUE).toBe('%2F/agentflow.flow-run.dlq');
  });
});
