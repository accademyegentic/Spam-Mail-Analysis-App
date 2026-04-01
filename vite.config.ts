import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // On GitHub Pages the site lives at /<repo-name>/
  // VITE_BASE_PATH is injected by the deploy workflow.
  // Locally it falls back to '/' so the dev server works unchanged.
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
