/**
 * Centralised configuration for the dashboard.
 *
 * Resolution order:
 *   1. `window.__APP_CONFIG__` - injected by `/config.js`, written at container start
 *      from the `APP_*` environment variables. This is what production uses, so the
 *      same image runs unchanged in every environment.
 *   2. `import.meta.env.VITE_*` - baked in by `vite dev` / `vite build`.
 *   3. A local development default.
 */
type ConfigBag = Record<string, string | undefined>;

declare global {
  interface Window {
    __APP_CONFIG__?: ConfigBag;
  }
}

const runtimeConfig: ConfigBag =
  (typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined) ?? {};

const buildEnv: ConfigBag = (import.meta.env ?? {}) as ConfigBag;

export const API_BASE_URL =
  runtimeConfig.API_BASE_URL || buildEnv.VITE_API_BASE_URL || 'http://localhost:3000';

/** Base URL of the RabbitMQ management UI, without a trailing slash. */
export const RABBITMQ_MGMT_URL =
  runtimeConfig.RABBITMQ_MGMT_URL || buildEnv.VITE_RABBITMQ_MGMT_URL || 'http://localhost:15672';

/**
 * Queue shown by the DLQ console, as the `<vhost>/<queue>` path fragment used by the
 * RabbitMQ management UI (`%2F` is the URL-encoded default vhost `/`).
 */
export const DLQ_QUEUE =
  runtimeConfig.DLQ_QUEUE || buildEnv.VITE_DLQ_QUEUE || '%2F/agentflow.flow-run.dlq';
