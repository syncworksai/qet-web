// src/api/axios.js
import axios from "axios";

/**
 * Base API URL (build-time via Vite):
 *   VITE_API_BASE_URL = https://quantum-edge-fx.onrender.com
 * Falls back to localhost for dev.
 */
export const BASE =
  (import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "")) ||
  "http://127.0.0.1:8000";

/**
 * PUBLIC client (no interceptors, no tokens) — use this on pages that
 * must not auto-redirect on 401 (e.g., /register, password reset).
 */
export const apiPublic = axios.create({
  baseURL: BASE,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

/**
 * AUTHED client (with token + refresh + 401 redirect)
 */
export const api = axios.create({
  baseURL: BASE,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// ----- helpers -----
const AUTH_SKIP_REGEX =
  /\/api\/users\/(token(?:\/refresh)?|register|password|reset|verify|activate)\/?$/i;

function broadcastLogoutAndRedirect() {
  try {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    // notify other tabs
    localStorage.setItem("auth_event", `logout:${Date.now()}`);
  } catch {}
  if (typeof window !== "undefined") window.location.assign("/login");
}

// attach access token, if present
api.interceptors.request.use((config) => {
  const access = localStorage.getItem("access");
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

let refreshingPromise = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) throw error;

    const status = response.status;

    // Only try refresh for non-auth endpoints
    if (status === 401 && !config.__isRetry && !AUTH_SKIP_REGEX.test(config.url || "")) {
      const refresh = localStorage.getItem("refresh");
      if (!refresh) {
        broadcastLogoutAndRedirect();
        throw error;
      }

      try {
        if (!refreshingPromise) {
          refreshingPromise = axios
            .post(`${BASE}/api/users/token/refresh/`, { refresh }, {
              headers: { "Content-Type": "application/json", Accept: "application/json" },
            })
            .then((res) => {
              const newAccess = res.data?.access;
              if (!newAccess) throw new Error("No access token in refresh response");
              localStorage.setItem("access", newAccess);
              return newAccess;
            })
            .finally(() => {
              setTimeout(() => { refreshingPromise = null; }, 0);
            });
        }

        const newAccess = await refreshingPromise;
        config.__isRetry = true;
        config.headers = { ...(config.headers || {}), Authorization: `Bearer ${newAccess}` };
        return api.request(config);
      } catch (e) {
        broadcastLogoutAndRedirect();
        throw e;
      }
    }

    throw error;
  }
);

export default api;
