// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // You can override these in .env/.env.local if needed
  const API_TARGET =
    env.VITE_API_TARGET ||
    env.VITE_API_BASE_URL ||
    env.VITE_API_BASE ||
    "http://127.0.0.1:8000";

  const MEDIA_TARGET = env.VITE_MEDIA_TARGET || API_TARGET;

  return defineConfig({
    plugins: [react()],
    server: {
      host: true,             // allow LAN access (optional)
      port: 5173,
      hmr: { overlay: true },
      proxy: {
        // Proxy API + media to Django for local dev
        "/api":   { target: API_TARGET, changeOrigin: true, secure: false },
        "/media": { target: MEDIA_TARGET, changeOrigin: true, secure: false },
        // Optional: debug helpers
        "/__health": { target: API_TARGET, changeOrigin: true, secure: false },
        "/__routes": { target: API_TARGET, changeOrigin: true, secure: false },
      },
    },
    preview: {
      host: true,
      port: 5173,
      proxy: {
        "/api":   { target: API_TARGET, changeOrigin: true, secure: false },
        "/media": { target: MEDIA_TARGET, changeOrigin: true, secure: false },
      },
    },
    define: { "process.env": {} },
  });
};
