import { defineConfig } from 'vitest/config';

// Kept apart from vite.config.ts: Vitest runs its own Vite major, and the
// tests need no plugin (esbuild compiles the JSX from tsconfig's `react-jsx`).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
