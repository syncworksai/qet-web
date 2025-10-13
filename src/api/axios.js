// src/api/axios.js
import axios from "axios";

/** Detect local dev host */
const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

/** Env base from Vite (may be empty) */
const ENV_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  "";

/** Final API base (no trailing slash) */
export const API_BASE =
  (isLocal ? "http://localhost:8000" : ENV_BASE).replace(/\/+$/, "") ||
  (typeof window !== "undefined"
    ? window.location.origin.replace(/\/+$/, "")
    : "http://localhost:8000");

/**
 * Normalize a URL so that:
 *  - relative & same-host absolute URLs are forced under /api/
 *  - the PATH has a trailing slash
 *  - any route-template leftovers like `/:id` are sanitized to `/id`
 *  - query/hash are preserved
 *  - third-party absolute URLs are untouched
 */
function normalizeUrl(url) {
  if (!url) return "/api/";

  const u = String(url);

  // helper to clean route-template colons and add trailing slash to PATH only
  const cleanAndSlash = (path = "", query = "", hash = "") => {
    let p = path;
    p = p.replace(/\/:([^/?#]+)/g, "/$1"); // "/:id" -> "/id"
    if (!p.endsWith("/")) p += "/";
    return p + (query || "") + (hash || "");
  };

  // ABSOLUTE?
  if (/^https?:\/\//i.test(u)) {
    try {
      const abs = new URL(u);
      const base = new URL(API_BASE);
      const sameHost =
        abs.protocol === base.protocol &&
        abs.hostname === base.hostname &&
        abs.port === base.port;

      if (!sameHost) return u; // third-party host → leave as-is

      const match = abs.pathname.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
      let path = match?.[1] ?? "";
      const query = match?.[2] ?? "";
      const hash = match?.[3] ?? "";

      if (!path.startsWith("/")) path = "/" + path;
      if (!path.startsWith("/api/")) path = "/api" + (path === "/" ? "/" : path);

      const normalized = cleanAndSlash(path, query, hash);
      return `${base.origin}${normalized}`;
    } catch {
      return u;
    }
  }

  // RELATIVE
  const match = u.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  let path = match?.[1] ?? "";
  const query = match?.[2] ?? "";
  const hash = match?.[3] ?? "";

  if (!path.startsWith("/")) path = "/" + path;
  if (!path.startsWith("/api/")) path = "/api" + path;

  return cleanAndSlash(path, query, hash);
}

/** Public, no auth */
export const apiPublic = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

/** Authed */
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

/** Normalize all URLs (relative + same-host absolute) */
apiPublic.interceptors.request.use((cfg) => {
  cfg.url = normalizeUrl(cfg.url || "");
  return cfg;
});
api.interceptors.request.use((cfg) => {
  cfg.url = normalizeUrl(cfg.url || "");
  const token = (() => {
    try {
      return localStorage.getItem("access");
    } catch {
      return null;
    }
  })();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

/** Refresh flow for 401s (skip auth endpoints) */
const AUTH_SKIP =
  /\/api\/users\/(token(?:\/refresh)?|register|password|reset|verify|activate)\/?$/i;

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const { response, config } = err || {};
    if (!response || !config) throw err;

    if (
      response.status !== 401 ||
      config.__isRetry ||
      AUTH_SKIP.test(config.url || "")
    )
      throw err;

    const refresh = (() => {
      try {
        return localStorage.getItem("refresh");
      } catch {
        return null;
      }
    })();
    if (!refresh) {
      try {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      } catch {}
      if (typeof window !== "undefined") window.location.assign("/login");
      throw err;
    }

    try {
      if (!refreshing) {
        refreshing = axios
          .post(
            `${API_BASE}/api/users/token/refresh/`,
            { refresh },
            { headers: { "Content-Type": "application/json" } }
          )
          .then((res) => {
            const nxt = res.data?.access;
            if (!nxt) throw new Error("No access token in refresh response");
            try {
              localStorage.setItem("access", nxt);
            } catch {}
            return nxt;
          })
          .finally(() => {
            setTimeout(() => {
              refreshing = null;
            }, 0);
          });
      }
      const newAccess = await refreshing;
      config.__isRetry = true;
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${newAccess}`,
      };
      return api.request(config);
    } catch (e) {
      try {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      } catch {}
      if (typeof window !== "undefined") window.location.assign("/login");
      throw e;
    }
  }
);

// Dev hint
if (typeof window !== "undefined" && import.meta?.env?.DEV) {
  // eslint-disable-next-line no-console
  console.log("[QE] API_BASE =", API_BASE);
}

/** Helper to build /api/.../ paths consistently */
export const apiPath = (p) => {
  let s = typeof p === "string" ? p : "";
  const match = s.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  let path = match?.[1] ?? "";
  const query = match?.[2] ?? "";
  const hash = match?.[3] ?? "";
  path = path.replace(/\/:([^/?#]+)/g, "/$1");
  if (!path.startsWith("/")) path = "/" + path;
  if (!path.endsWith("/")) path += "/";
  return "/api" + path + query + hash;
};

export const apiNoAuth = apiPublic;
export default api;
