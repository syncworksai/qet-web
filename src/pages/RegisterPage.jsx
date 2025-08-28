// src/pages/RegisterPage.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/axios";
import logo from "../assets/QELOGO.png";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // optional if your API allows
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      // Adjust if your backend expects different payload keys
      await api.post("/api/users/register/", {
        username,
        email: email || undefined,
        password,
      });
      setOk("Account created. You can sign in now.");
      // slight delay so users can read the message
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      console.error("register failed", err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.response?.data?.message ||
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

        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}
        {ok && <div className="mb-3 text-sm text-emerald-300">{ok}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">
              Email <span className="opacity-60">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Confirm Password</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
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
          Already have an account?{" "}
          <Link to="/login" className="underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
