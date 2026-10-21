import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Web client for Knowledge Bank. Proxies /api to the Express backend so the
// browser only ever talks to one origin (needed for the hosted preview too).
export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        xfwd: true,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
