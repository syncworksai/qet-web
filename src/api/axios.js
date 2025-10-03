// src/api/axios.js
import axios from "axios";

/**
 * Base host ONLY (no /api here).
 * We’ll prepend /api per request so the final URLs look like:
 * https://quantum-edge-fx.onrender.com/api/...
 */
export const API_BASE = "https://quantum-edge-fx.onrender.com";

/** Ensure leading AND trailing slash (DRF expects trailing /) */
const norm = (p) => {
  let s = p.startsWith("/") ? p : `/${p}`;
  if (!s.endsWith("/")) s += "/";
  return s;
};

/** Build a full API path like "/api/users/register/" */
export const apiPath = (p) => `/api${norm(p)}`;

/** PUBLIC client (no tokens/interceptors) */
export const apiPublic = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

/** Back-compat alias used in your code */
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

/* ---------------- Auth refresh helpers ---------------- */

const AUTH_SKIP_REGEX =
  /\/api\/users\/(token(?:\/refresh)?|register|password|reset|verify|activate)\/?$/i;

function broadcastLogoutAndRedirect() {
  try {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.setItem("auth_event", `logout:${Date.now()}`);
  } catch {}
  if (typeof window !== "undefined") window.location.assign("/login");
}

// Attach access token for authed client
api.interceptors.request.use((config) => {
  try {
    const access = localStorage.getItem("access");
    if (access) config.headers.Authorization = `Bearer ${access}`;
  } catch {}
  return config;
});

let refreshingPromise = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) throw error;

    const status = response.status;

    if (
      status === 401 &&
      !config.__isRetry &&
      !AUTH_SKIP_REGEX.test(config.url || "")
    ) {
      const refresh = (() => {
        try {
          return localStorage.getItem("refresh");
        } catch {
          return null;
        }
      })();

      if (!refresh) {
        broadcastLogoutAndRedirect();
        throw error;
      }

      try {
        if (!refreshingPromise) {
          refreshingPromise = axios
            .post(
              `${API_BASE}${apiPath("users/token/refresh/")}`,
              { refresh },
              {
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
              }
            )
            .then((res) => {
              const newAccess = res.data?.access;
              if (!newAccess) throw new Error("No access token in refresh response");
              try {
                localStorage.setItem("access", newAccess);
              } catch {}
              return newAccess;
            })
            .finally(() => {
              setTimeout(() => {
                refreshingPromise = null;
              }, 0);
            });
        }

        const newAccess = await refreshingPromise;
        config.__isRetry = true;
        config.headers = {
          ...(config.headers || {}),
          Authorization: `Bearer ${newAccess}`,
        };
        return api.request(config);
      } catch (e) {
        broadcastLogoutAndRedirect();
        throw e;
      }
    }

    throw error;
  }
);

/* ---------------- Temporary debug (remove later) ---------------- */

if (typeof window !== "undefined") {
  console.log("[QE] API_BASE =", API_BASE);
}
apiPublic.interceptors.request.use((c) => {
  console.log("[QE] PUBLIC →", c.method?.toUpperCase(), c.baseURL + (c.url || ""));
  return c;
});
api.interceptors.request.use((c) => {
  console.log("[QE] AUTH   →", c.method?.toUpperCase(), c.baseURL + (c.url || ""));
  return c;
});
