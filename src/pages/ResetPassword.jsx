// src/pages/ResetPassword.jsx
import React, { useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { api } from "../api/axios";
import logo from "../assets/QELOGO.png";

const CONFIRM_ENDPOINT = "/api/users/password/reset/confirm/";

export default function ResetPassword() {
  const { uid, token } = useParams();
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // If this page is hit without uid/token, send to request form
  if (!uid || !token) {
    return <Navigate to="/reset-password" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password1.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password1 !== password2) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await api.post(CONFIRM_ENDPOINT, {
        uid,
        token,
        new_password: password1,
      });
      setDone(true);
    } catch (err) {
      console.error("reset confirm failed", err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Invalid or expired link. Request a new reset email.";
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
          <h1 className="text-xl font-semibold">Choose a new password</h1>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
              Your password has been reset. You can sign in now.
            </div>
            <Link
              to="/login"
              className="w-full block text-center bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-[color:var(--muted)] mb-1">New password</label>
              <input
                type="password"
                value={password1}
                onChange={(e) => setPassword1(e.target.value)}
                className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--muted)] mb-1">Confirm password</label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                required
              />
            </div>

            {error && <div className="text-red-400 text-sm">{error}</div>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save new password"}
            </button>

            <div className="text-center text-xs text-[color:var(--muted)]">
              Link not working? <Link to="/reset-password" className="underline">Request a new link</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
