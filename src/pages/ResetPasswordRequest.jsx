// src/pages/ResetPasswordRequest.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/axios";
import logo from "../assets/QELOGO.png";

const RESET_ENDPOINT = "/api/users/password/reset/";

export default function ResetPasswordRequest() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post(RESET_ENDPOINT, { email });
      setSent(true); // always 200 from backend (doesn't leak if email exists)
    } catch (err) {
      console.error("reset request failed", err);
      if (err.response?.status === 404) {
        setError("Endpoint not found. Check your backend route for password reset.");
      } else if (err.response?.status === 400) {
        setError("Please enter a valid email.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[color:var(--card)] border border-white/10 rounded-xl p-6">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="QE" className="h-10 mb-2" />
          <h1 className="text-xl font-semibold">Reset your password</h1>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            Enter your account email and we’ll send a reset link.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
              Check your inbox for a password reset link. If you don’t see it, look in spam.
            </div>
            <div className="grid gap-2">
              <Link
                to="/login"
                className="w-full text-center border border-white/10 text-neutral-200 rounded py-2 hover:bg-neutral-800"
              >
                Back to sign in
              </Link>
              <Link
                to="/pricing"
                className="w-full text-center border border-white/10 text-neutral-200 rounded py-2 hover:bg-neutral-800"
              >
                Pricing
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-[color:var(--muted)] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                placeholder="you@example.com"
                required
              />
            </div>

            {error && <div className="text-red-400 text-sm">{error}</div>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>

            <div className="text-center text-xs text-[color:var(--muted)]">
              Remembered your password?{" "}
              <Link to="/login" className="underline">Sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
