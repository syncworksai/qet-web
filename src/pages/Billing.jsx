// src/pages/Billing.jsx
import React, { useState } from "react";
import { api } from "../api/axios";

export default function Billing() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function startCheckout() {
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/api/billing/checkout-session/");
      if (data?.url) window.location.href = data.url;
      else setErr("Could not start checkout.");
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.detail || "Checkout failed.");
    } finally { setBusy(false); }
  }

  async function openPortal() {
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/api/billing/portal-session/");
      if (data?.url) window.location.href = data.url;
      else setErr("Could not open billing portal.");
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.detail || "Portal failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-[color:var(--card)] border border-white/10 rounded-xl p-6">
        <h1 className="text-xl font-semibold mb-2">Billing</h1>
        <p className="text-sm text-[color:var(--muted)] mb-4">
          Subscribe or manage your subscription.
        </p>

        {err && <div className="mb-3 text-sm text-red-400">{err}</div>}

        <div className="grid gap-3">
          <button
            onClick={startCheckout}
            disabled={busy}
            className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Working…" : "Subscribe with Stripe Checkout"}
          </button>

          <button
            onClick={openPortal}
            disabled={busy}
            className="w-full border border-white/10 text-neutral-200 rounded py-2 hover:bg-neutral-800 disabled:opacity-60"
          >
            {busy ? "Working…" : "Manage billing (Stripe Portal)"}
          </button>
        </div>

        <p className="text-xs text-[color:var(--muted)] mt-4">
          Payments are handled by Stripe. You can cancel anytime.
        </p>
      </div>
    </div>
  );
}
