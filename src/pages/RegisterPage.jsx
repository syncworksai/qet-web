// src/pages/RegisterPage.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiPublic } from "../api/axios";
import logo from "../assets/QELOGO.png";

const STRIPE_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK;

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (pw1 !== pw2) {
      setError("Passwords do not match.");
      return;
    }
    if (!STRIPE_LINK) {
      setError("Payment link is not configured. Set VITE_STRIPE_PAYMENT_LINK and redeploy.");
      return;
    }

    setBusy(true);
    try {
      // IMPORTANT: use apiPublic (no tokens, no 401 redirect)
      await apiPublic.post("/api/users/register/", {
        username,
        email,
        password: pw1,
      });

      // Success → go to Stripe
      window.location.assign(STRIPE_LINK);
    } catch (err) {
      console.error("register failed", err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Registration failed. Please try again.";
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[color:var(--card)] border border-white/10 rounded-xl p-6">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="QE" className="h-10 mb-2" />
          <h1 className="text-xl font-semibold">Create account</h1>
          <p className="text-xs text-[color:var(--muted)] mt-1">Join QuantumEdge</p>
        </div>

        {error && <div className="mb-3 text-red-400 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Username</label>
            <input
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Email (optional)</label>
            <input
              type="email"
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Confirm Password</label>
            <input
              type="password"
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-[color:var(--muted)]">
          Already have an account? <Link to="/login" className="underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
