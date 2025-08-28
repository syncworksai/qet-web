// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { api } from "../api/axios";
import logo from "../assets/QELOGO.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // ✅ Correct endpoint
      const res = await api.post("/api/users/token/", { username, password });
      const { access, refresh } = res.data || {};
      if (!access || !refresh) throw new Error("No tokens returned");
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      const dest = location.state?.from?.pathname || "/";
      navigate(dest);
    } catch (err) {
      console.error("login failed", err);
      if (err.response?.status === 404) {
        setError("API endpoint not found. Check your API base URL and backend routes.");
      } else if (err.response?.status === 401) {
        setError("Invalid username or password.");
      } else {
        setError("Login failed. Please try again.");
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
          <h1 className="text-xl font-semibold">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
            />
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-[color:var(--muted)]">
             Need an account? <Link to="/request-access" className="underline">Request access</Link>
        </div>

      </div>
    </div>
  );
}
