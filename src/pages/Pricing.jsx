// src/pages/Pricing.jsx
import React from "react";
import { Link } from "react-router-dom";

const PAY_LINK   = import.meta.env.VITE_STRIPE_PAYMENT_LINK || "";
const PRICE_NOW  = import.meta.env.VITE_PRICE_NOW || "10.00";   // marketing price
const PRICE_WAS  = import.meta.env.VITE_PRICE_WAS || "19.00";   // crossed-out compare-at
const CURRENCY   = import.meta.env.VITE_PRICE_CURRENCY || "USD";

export default function Pricing() {
  const missing = !PAY_LINK;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
        {/* Left: product value copy */}
        <div className="rounded-xl border border-white/10 p-6 bg-[color:var(--card)]">
          <h1 className="text-2xl font-semibold mb-2">Quantum Edge Pro</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Journal, analytics, psych profile, TraderLab & more—built for serious traders.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>• Trade journaling with photo/file attachments</li>
            <li>• P&amp;L analytics, R-multiples, hour-of-day stats</li>
            <li>• Psych Quiz archetype + guidance</li>
            <li>• Watchlist, charts, news &amp; FX calendar</li>
            <li>• Early access to advanced courses</li>
          </ul>

          <div className="mt-6 flex items-center gap-3">
            <Badge>Cancel anytime</Badge>
            <Badge>Secure checkout</Badge>
            <Badge>Instant access</Badge>
          </div>
        </div>

        {/* Right: price card */}
        <div className="rounded-xl border border-white/10 p-6 bg-[color:var(--card)]">
          <div className="flex items-baseline gap-3">
            {PRICE_WAS && (
              <div className="text-2xl font-semibold line-through text-neutral-500">
                ${Number(PRICE_WAS).toFixed(2)}
                <span className="text-sm font-normal text-neutral-500">/mo</span>
              </div>
            )}
            <div className="text-4xl font-bold">
              ${Number(PRICE_NOW).toFixed(2)}
              <span className="text-base font-medium text-[color:var(--muted)]">/mo</span>
            </div>
          </div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            {CURRENCY} • Quantum Edge Pro
          </div>

          <div className="mt-6 grid gap-3">
            {/* Stripe Payment Link button — force text color so it’s always visible */}
            <a
              href={PAY_LINK || "#"}
              target="_blank"
              rel="noreferrer"
              aria-label="Subscribe with Stripe"
              className={`w-full text-center font-semibold py-2 rounded ${
                missing
                  ? "bg-neutral-700 cursor-not-allowed"
                  : "bg-[color:var(--accent)] hover:opacity-90"
              }`}
              style={{ color: missing ? "#d1d5db" : "#0b0b10" }} /* ← force dark text */
              onClick={(e) => { if (missing) e.preventDefault(); }}
            >
              {missing ? "Payment link not set" : "Subscribe"}
            </a>

            <Link
              to="/register"
              className="w-full text-center border border-white/10 text-neutral-200 rounded py-2 hover:bg-neutral-800"
            >
              Already subscribed? Create your account
            </Link>

            <Link
              to="/login"
              className="w-full text-center border border-white/10 text-neutral-200 rounded py-2 hover:bg-neutral-800"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-4 text-xs text-[color:var(--muted)]">
            Tip: Use the <b>same email</b> on checkout and registration for smooth access.
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span
      className="text-xs px-2 py-1 rounded-lg border"
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--muted)",
      }}
    >
      {children}
    </span>
  );
}
