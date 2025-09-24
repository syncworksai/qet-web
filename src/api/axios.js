// src/api/axios.js
import axios from "axios";

/**
 * Accept either:
 *  - VITE_API_BASE       = https://host.tld/api
 *  - VITE_API_BASE_URL   = https://host.tld   (no /api)
 * Normalize to ".../api".
 */
const RAW =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

const ROOT = RAW.replace(/\/+$/, "");           // strip trailing slashes
export const API_BASE = /\/api$/.test(ROOT) ? ROOT : `${ROOT}/api`;

/** PUBLIC client (no tokens/interceptors) */
export const apiPublic = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

/** 🔁 Back-compat alias: some pages import { apiNoAuth } */
export const apiNoAuth = apiPublic;

/** AUTHED client (token + refresh on 401) */
export const api = axios.create({
  baseURL: API_BASE,
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
    localStorage.setItem("auth_event", `logout:${Date.now()}`); // notify other tabs
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
            .post(`${API_BASE}/users/token/refresh/`, { refresh }, {
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
