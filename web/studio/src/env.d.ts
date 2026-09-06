/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Runtime configuration served by `/config.js` and generated at container start from the
 * `APP_*` environment variables (see `web/nginx/40-runtime-config.sh`). Absent under
 * `vite dev` unless `public/config.js` provides it, hence the optional marker.
 */
interface Window {
  __APP_CONFIG__?: Record<string, string | undefined>;
}
