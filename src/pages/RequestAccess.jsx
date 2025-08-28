// src/pages/RequestAccess.jsx
import React, { useState } from "react";
import { api } from "../api/axios";
import logo from "../assets/QELOGO.png";

export default function RequestAccess() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      // adjust to your backend route
      await api.post("/api/leads/request-access/", { name, email, company, message });
      setOk(true);
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.detail || "Could not submit your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[color:var(--card)] border border-white/10 rounded-xl p-6">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="QE" className="h-10 mb-2" />
          <h1 className="text-xl font-semibold">Request access</h1>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            Tell us a bit about you. We’ll get back quickly.
          </p>
        </div>

        {ok ? (
          <div className="text-sm text-emerald-300">
            Thanks! We’ve received your request—check your email shortly.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {err && <div className="text-sm text-red-400">{err}</div>}
            <div>
              <label className="block text-xs text-[color:var(--muted)] mb-1">Name</label>
              <input
                className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                value={name} onChange={(e)=>setName(e.target.value)} required
              />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--muted)] mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                value={email} onChange={(e)=>setEmail(e.target.value)} required
              />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--muted)] mb-1">Company (optional)</label>
              <input
                className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                value={company} onChange={(e)=>setCompany(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--muted)] mb-1">Use case</label>
              <textarea
                rows={3}
                className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="How do you plan to use QuantumEdge?"
              />
            </div>
            <button
              type="submit" disabled={busy}
              className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
