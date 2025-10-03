// src/pages/RegisterPage.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiPublic as apiNoAuth, apiPath } from "../api/axios";
import logo from "../assets/QELOGO.png";

/** Read your universal Stripe Payment Link (set in Vercel env) */
const STRIPE_PAYMENT_LINK =
  import.meta.env.VITE_STRIPE_PAYMENT_LINK_ALL ||
  import.meta.env.VITE_STRIPE_PAYMENT_LINK ||
  "";

/** Convert axios error -> human-readable string(s) */
function parseError(err) {
  if (!err?.response) return "Network error. Please check your connection.";
  const { status, data } = err.response;

  if (typeof data === "string") {
    const looksHtml = /<html|<!doctype/i.test(data);
    if (looksHtml) {
      if (status >= 500) return "Server error (500). Please try again.";
      if (status === 404) return "Endpoint not found (404). Check API route.";
      return `Error ${status}. Please try again.`;
    }
    return data;
  }

  const msgs = [];
  if (data?.detail) msgs.push(String(data.detail));
  Object.keys(data || {}).forEach((k) => {
    if (k === "detail") return;
    const v = data[k];
    if (Array.isArray(v)) v.forEach((m) => msgs.push(`${k}: ${m}`));
    else if (typeof v === "string") msgs.push(`${k}: ${v}`);
  });

  if (msgs.length) return msgs.join("\n");

  if (status === 404) return "Endpoint not found (404). Check API route.";
  if (status === 400) return "Invalid submission. Please review the fields.";
  if (status === 401) return "Unauthorized.";
  if (status >= 500) return "Server error. Please try again.";
  return "Registration failed. Please try again.";
}

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // optional
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Post-success state
  const [created, setCreated] = useState(false);

  // Disclosure checkboxes (must be checked to proceed)
  const [disclosureChecked, setDisclosureChecked] = useState(false);
  const [paymentDisclosureChecked, setPaymentDisclosureChecked] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!disclosureChecked) {
      setError("Please acknowledge the Trading Risk & Responsibility disclosure to continue.");
      return;
    }
    if (!username.trim()) return setError("Please enter a username.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setBusy(true);
    try {
      // ✅ POST to /api/users/register/
      await apiNoAuth.post(
        apiPath("users/register/"),
        {
          username: username.trim(),
          email: email.trim() || undefined,
          password,
        }
      );

      // Success → show success panel then user clicks “Continue to Payment”
      setCreated(true);
      // reset first-stage checkbox so we don't carry it over by mistake
      setDisclosureChecked(false);
    } catch (err) {
      console.error("register failed", err);
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  const labelMuted = "text-xs text-[color:var(--muted)] mb-1";
  const inputCls =
    "w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[color:var(--card)] border border-white/10 rounded-xl p-6">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="QE" className="h-10 mb-2" />
          <h1 className="text-xl font-semibold">Create account</h1>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            You’ll be sent to secure checkout after creating your account.
          </div>
        </div>

        {/* Success step */}
        {created ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-200">
              <div className="font-semibold">Account created 🎉</div>
              <div className="text-sm opacity-80 mt-1">
                Step 2: Subscribe to unlock access.
              </div>
            </div>

            {/* Trading disclosure (must check to proceed to payment) */}
            <TradingDisclosure />

            <AckCheckbox
              id="ack-after"
              checked={paymentDisclosureChecked}
              onChange={setPaymentDisclosureChecked}
              label="I understand and agree to the Trading Risk & Responsibility disclosure above."
            />

            <button
              onClick={() => {
                if (!paymentDisclosureChecked) return;
                if (!STRIPE_PAYMENT_LINK) {
                  setError(
                    "Payment link is not configured. Ask support to set VITE_STRIPE_PAYMENT_LINK_ALL in Vercel."
                  );
                  return;
                }
                window.location.assign(STRIPE_PAYMENT_LINK);
              }}
              disabled={!paymentDisclosureChecked}
              className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90 disabled:opacity-60"
            >
              Continue to Payment
            </button>

            <div className="text-center text-sm" style={{ color: "var(--muted)" }}>
              Prefer to subscribe later?{" "}
              <Link to="/login" className="underline text-[color:var(--accent)]">
                Sign in
              </Link>
            </div>

            {error && (
              <div className="whitespace-pre-wrap text-sm rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                {error}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Top error */}
            {error && (
              <div className="mb-4 whitespace-pre-wrap text-sm rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className={labelMuted}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputCls}
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className={labelMuted}>
                  Email <span className="opacity-60">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className={labelMuted}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div>
                <label className={labelMuted}>Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                  required
                />
              </div>

              {/* Trading disclosure (must check to create account) */}
              <TradingDisclosure />

              <AckCheckbox
                id="ack-before"
                checked={disclosureChecked}
                onChange={setDisclosureChecked}
                label="I understand and agree to the Trading Risk & Responsibility disclosure above."
              />

              <button
                type="submit"
                disabled={busy || !disclosureChecked}
                className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create account"}
              </button>
            </form>

            <div className="mt-4 text-center text-sm" style={{ color: "var(--muted)" }}>
              Already have an account?{" "}
              <Link to="/login" className="underline text-[color:var(--accent)]">
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** -------- Components -------- */

function TradingDisclosure() {
  return (
    <div className="mt-3 text-xs leading-relaxed rounded-lg border border-white/10 bg-black/20 p-3 text-neutral-300">
      <div className="font-semibold text-neutral-200 mb-1">Trading Risk & Responsibility</div>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          QuantumEdge is <b>not</b> a brokerage, dealer, or introducing broker and does not accept,
          route, or execute orders.
        </li>
        <li>
          We provide <b>tools and educational content</b>. Nothing here is financial advice or a
          recommendation to buy/sell any instrument.
        </li>
        <li>
          We may work with or link to <b>partner firms</b> (including funded challenges). You are
          free to choose any provider. We may receive an affiliate commission at no extra cost to you.
        </li>
        <li>
          <b>Trading involves substantial risk of loss.</b> You trade at your own risk and are solely
          responsible for your decisions and results. <b>Past performance does not guarantee future results.</b>
        </li>
        <li>
          The <b>app is sold separately</b>. Coaching, mentorship, courses, and webinars are optional
          add-ons and are not included by default.
        </li>
        <li>
          Use the <b>same email</b> for registration and checkout to streamline access.
        </li>
      </ul>
    </div>
  );
}

function AckCheckbox({ id, checked, onChange, label }) {
  return (
    <label htmlFor={id} className="mt-2 flex items-start gap-2 text-xs text-neutral-300">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-cyan-400"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span>{label}</span>
    </label>
  );
}
