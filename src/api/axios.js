// src/api/axios.js
import axios from "axios";

/**
 * Base API URL:
 * - Uses env in prod: VITE_API_BASE_URL = https://<your-api>.onrender.com
 * - Falls back to localhost for dev.
 */
const BASE =
  (import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "")) ||
  "http://127.0.0.1:8000";

// Create an axios instance for app API calls
export const api = axios.create({
  baseURL: BASE,
  withCredentials: false, // Bearer token auth, no cookies
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// --- Helpers ---

// Skip refresh logic on auth endpoints like /api/users/token/ and /api/users/token/refresh/
const AUTH_SKIP_REGEX =
  /\/api\/users\/(token(?:\/refresh)?|register|reset|password|verify|activate)\/?$/i;

function broadcastLogoutAndRedirect() {
  try {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    // Real cross-tab signal: this triggers 'storage' in other tabs
    localStorage.setItem("auth_event", `logout:${Date.now()}`);
  } catch {}
  // Force to login route
  if (typeof window !== "undefined") window.location.assign("/login");
}

// Attach access token if present
api.interceptors.request.use((config) => {
  const access = localStorage.getItem("access");
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// Single in-flight refresh promise (shared by all 401s)
let refreshingPromise = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) throw error;

    const status = response.status;

    // If unauthorized and not already retried, try refresh (except auth endpoints)
    if (status === 401 && !config.__isRetry && !AUTH_SKIP_REGEX.test(config.url || "")) {
      const refresh = localStorage.getItem("refresh");
      if (!refresh) {
        broadcastLogoutAndRedirect();
        throw error;
      }

      try {
        // If a refresh is already happening, await it
        if (!refreshingPromise) {
          // IMPORTANT: use base axios (not `api`) so we don't recurse interceptors
          refreshingPromise = axios
            .post(`${BASE}/api/users/token/refresh/`, { refresh }, {
              headers: { "Content-Type": "application/json", Accept: "application/json" },
            })
            .then((res) => {
              const newAccess = res.data?.access;
              if (newAccess) {
                localStorage.setItem("access", newAccess);
                return newAccess;
              }
              throw new Error("No access token in refresh response");
            })
            .finally(() => {
              // reset after completion (success or failure)
              setTimeout(() => {
                refreshingPromise = null;
              }, 0);
            });
        }

        const newAccess = await refreshingPromise;
        if (!newAccess) {
          broadcastLogoutAndRedirect();
          throw error;
        }

        // Retry original request once with new token
        config.__isRetry = true;
        config.headers = {
          ...(config.headers || {}),
          Authorization: `Bearer ${newAccess}`,
        };
        return api.request(config);
      } catch (e) {
        // Refresh failed → logout & redirect
        broadcastLogoutAndRedirect();
        throw e;
      }
    }

    // Propagate other errors
    throw error;
  }
);

export default api;
