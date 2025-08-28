// vite.config.js (same as yours, with tiny extras)
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const API_TARGET = env.VITE_API_TARGET || 'http://127.0.0.1:8000';
  const MEDIA_TARGET = env.VITE_MEDIA_TARGET || API_TARGET;

  return defineConfig({
    plugins: [react()],
    server: {
      host: true,          // allow LAN access (optional)
      port: 5173,
      hmr: { overlay: true }, // set to false if you want to hide red error overlay
      proxy: {
        '/api':   { target: API_TARGET, changeOrigin: true, secure: false },
        '/media': { target: MEDIA_TARGET, changeOrigin: true, secure: false },
      },
    },
    preview: {
      host: true,
      port: 5173,
      proxy: {
        '/api':   { target: API_TARGET, changeOrigin: true, secure: false },
        '/media': { target: MEDIA_TARGET, changeOrigin: true, secure: false },
      },
    },
    define: { 'process.env': {} },
  });
};
