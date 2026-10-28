/**
 * Centralised environment resolution usable in browser (Vite) AND in Node (Jest).
 *
 * Resolution order:
 *   1. `window.__APP_CONFIG__` - injected by `/config.js`, written at container start
 *      from the `APP_*` environment variables. This is what production uses, so the
 *      same image runs unchanged in every environment.
 *   2. `import.meta.env.VITE_*` - baked in by `vite dev` / `vite build`.
 *   3. A local development default.
 */
type ConfigBag = Record<string, string | undefined>;

const runtimeConfig: ConfigBag =
  (typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined) ?? {};

const buildEnv: ConfigBag =
  (typeof import.meta !== 'undefined' ? ((import.meta as any).env as ConfigBag) : undefined) ?? {};

export const API_BASE_URL =
  runtimeConfig.API_BASE_URL || buildEnv.VITE_API_BASE_URL || 'http://localhost:3000';
