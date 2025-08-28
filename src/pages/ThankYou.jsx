// src/pages/ThankYou.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function ThankYou() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-[color:var(--card)] border border-white/10 rounded-xl p-6 text-center">
        <h1 className="text-2xl font-semibold">🎉 Thank you for subscribing!</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Your payment is complete. Next, create your account using the <b>same email</b> you used at checkout.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            to="/register"
            className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded hover:opacity-90"
          >
            Create your account
          </Link>
          <Link
            to="/login"
            className="w-full border border-white/10 text-neutral-200 rounded py-2 hover:bg-neutral-800"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-xs text-[color:var(--muted)]">
          Stuck? Forward your Stripe receipt to support and we’ll help ASAP.
        </p>
      </div>
    </div>
  );
}
