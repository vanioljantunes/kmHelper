/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// kmHelper does no network calls of any kind: there are no environment variables and nothing
// leaves the browser. Production builds are served at vanioantunes.com/tools/kmHelper/ (proxied
// from the site's Vercel project); dev, preview and e2e keep the root path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tools/kmHelper/' : '/',
  plugins: [react()],
  server: { port: 5182, strictPort: true },
  preview: { port: 5183, strictPort: true },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'tests/e2e/**'],
  },
}));
