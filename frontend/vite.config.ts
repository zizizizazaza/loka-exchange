import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Three pages, same paths as the prototype (v2-exchange/), deployed together:
 *   /             site (landing page, static HTML copied from the prototype)
 *   /app/         exchange app (React)
 *   /app/issuer/  issuer console for compute operators (React)
 * In development the backend runs on :3000; proxying /api keeps the app same-origin, so no CORS setup is needed.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        site: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
        issuer: resolve(import.meta.dirname, 'app/issuer/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
