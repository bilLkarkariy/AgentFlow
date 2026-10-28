import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deliberately no `define` override of the env object: the previous one replaced it with the
// whole build environment, leaking it into the bundle. Configuration is now read at runtime
// from /config.js (window.__APP_CONFIG__), see src/config.ts.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
