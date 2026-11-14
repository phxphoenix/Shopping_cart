import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { viteApiPlugin } from './src/server/viteApiPlugin';

const basePath = process.env.VITE_BASE_PATH ?? '/';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteApiPlugin(basePath)],
  base: basePath,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 4173,
  },
});
