// src/pages/ResetPassword.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/axios";
import logo from "../assets/QELOGO.png";

export default function ResetPassword() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Support either email or username; adjust key to match your backend
      await api.post("/api/users/reset-password/", {
        identifier: emailOrUsername, // if your API expects { email }, rename accordingly
      });
      setDone(true);
    } catch (err) {
      console.error("reset request failed", err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Could not start password reset.";
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
          <h1 className="text-xl font-semibold">Reset password</h1>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            Enter your email or username and we’ll send instructions.
          </p>
        </div>

        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}
        {done ? (
          <div className="mb-3 text-sm text-emerald-300">
            If an account exists, a reset email has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-[color:var(--muted)] mb-1">
                Email or Username
              </label>
              <input
                type="text"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                placeholder="you@example.com or trader123"
                required
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <div className="mt-4 text-center text-sm text-[color:var(--muted)]">
          <Link to="/login" className="underline">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
