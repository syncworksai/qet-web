// src/context/SubscriptionContext.jsx
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState
} from "react";
import { api } from "../api/axios";

/**
 * Backend shape (example /api/billing/status/):
 * { active: true, plan: "pro", renews_at: "...", source: "stripe" }
 */

const SubscriptionContext = createContext(null);

// Comma-separated list in .env, e.g.:
// VITE_SUBSCRIPTION_BYPASS=you@domain.com, yourusername
const BYPASS = (import.meta?.env?.VITE_SUBSCRIPTION_BYPASS || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export function SubscriptionProvider({ children }) {
  const [status, setStatus] = useState(null); // { isActive, plan, renewsAt, source, raw }
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchedOnceRef = useRef(false);

  const isAuthed = useMemo(() => {
    try { return Boolean(window.localStorage.getItem("access")); }
    catch { return false; }
  }, []);

  const mapStatus = useCallback((data) => {
    if (!data || typeof data !== "object") return null;
    return {
      isActive: Boolean(data.active || data.is_active || data.status === "active"),
      plan: data.plan ?? null,
      renewsAt: data.renews_at ?? null,
      source: data.source ?? null,
      raw: data,
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!isAuthed) {
      setUser(null);
      setStatus(null);
      setError(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const [me, bill] = await Promise.allSettled([
        api.get("/api/users/me/"),
        api.get("/api/billing/status/"),
      ]);
      if (me.status === "fulfilled") setUser(me.value?.data || null);
      const mapped = bill.status === "fulfilled" ? mapStatus(bill.value?.data) : null;
      setStatus(mapped);
      return mapped;
    } catch (err) {
      setError(err?.response?.data || err?.message || "Failed to load subscription status");
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthed, mapStatus]);

  useEffect(() => {
    if (isAuthed && !fetchedOnceRef.current) {
      fetchedOnceRef.current = true;
      fetchStatus();
    }
  }, [isAuthed, fetchStatus]);

  // Final "active" check: backend OR staff/superuser OR allowlist bypass
  const isActive = useMemo(() => {
    const back = Boolean(status?.isActive);
    const staff = Boolean(user?.is_staff || user?.is_superuser);
    const idEmail = String(user?.email || "").toLowerCase();
    const idName = String(user?.username || "").toLowerCase();
    const whitelisted = BYPASS.includes(idEmail) || BYPASS.includes(idName);
    return back || staff || whitelisted;
  }, [status, user]);

  const value = useMemo(
    () => ({
      loading,
      error,
      status,
      user,
      isAuthed,
      isActive,
      plan: status?.plan ?? null,
      renewsAt: status?.renewsAt ?? null,
      refetch: fetchStatus,
    }),
    [loading, error, status, user, fetchStatus, isAuthed, isActive]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within <SubscriptionProvider>");
  return ctx;
}
