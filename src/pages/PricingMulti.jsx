// src/pages/PricingMulti.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";

// 👇 Single hosted Stripe Payment Link that lets buyers choose add-ons
const PAYMENT_LINK_ALL =
  import.meta.env.VITE_STRIPE_PAYMENT_LINK_ALL ||
  "https://buy.stripe.com/fZu5kDbCG9n1gdrgJl2Nq05";

console.log("Pricing MULTI loaded (one-link mode)");

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

function Card({ title, price, features, onPrimary, onSecondary, secondaryLabel = "Buy Now" }) {
  return (
    <div className="rounded-xl border border-white/10 p-6 bg-[color:var(--card)] text-white flex flex-col">
      <div className="text-xl font-semibold">{title}</div>
      <div className="mt-2 text-4xl font-bold">
        {price || "—"}
        {price && <span className="text-base font-medium text-[color:var(--muted)]">/mo</span>}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {features?.map((f, i) => <li key={i}>• {f}</li>)}
      </ul>

      <div className="mt-6 grid gap-3">
        {/* Primary → ALWAYS go to the one Stripe Payment Link */}
        <button
          onClick={onPrimary}
          className="w-full text-center font-semibold py-2 rounded bg-[color:var(--accent)] hover:opacity-90"
          style={{ color: "#0b0b10" }}
        >
          Subscribe
        </button>

        {/* Secondary: optional “Buy Now” (same link, to reduce confusion) */}
        {onSecondary && (
          <button
            onClick={onSecondary}
            className="w-full text-center border border-white/10 text-neutral-200 rounded py-2 hover:bg-neutral-800"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PricingMulti() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState([]);

  const openStripe = () => {
    // Use replace so buyers don't come "Back" to a half state
    window.location.replace(PAYMENT_LINK_ALL);
  };

  // Load product copy (purely for display of names/prices/features)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api.get("/billing/pricing/");
        if (mounted) setPricing(r.data?.items || []);
      } catch (e) {
        console.error("Failed to load pricing:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const byKey = useMemo(() => {
    const map = {};
    for (const p of pricing) map[p.key] = p;
    return map;
  }, [pricing]);

  if (loading) return <div className="p-8 text-white">Loading pricing…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-6xl text-white">
        {/* Header/value props */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 p-6 bg-[color:var(--card)]">
            <h1 className="text-2xl font-semibold mb-2">Quantum Edge</h1>
            <p className="text-sm text-[color:var(--muted)]">
              Journal, analytics, psych profile, TraderLab & more—built for serious traders.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>• Trade journaling with photo/file attachments</li>
              <li>• P&amp;L analytics, R-multiples, hour-of-day stats</li>
              <li>• Psych Quiz archetype + guidance</li>
              <li>• Watchlist, charts, news &amp; FX calendar</li>
              <li>• Webinars & Courses (optional add-ons)</li>
            </ul>
            <div className="mt-6 flex items-center gap-3">
              <Badge>Cancel anytime</Badge>
              <Badge>Secure checkout</Badge>
              <Badge>Instant access</Badge>
            </div>
          </div>

          {/* Product cards */}
          <div className="rounded-xl border border-white/10 p-6 bg-[color:var(--card)]">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { k: "app",       label: "QuantumEdge App" },
                { k: "webinars",  label: "Live Webinars" },
                { k: "courses",   label: "Courses" },
                { k: "coaching",  label: "Coaching / Mentorship" },
              ].map(({ k, label }) => (
                <Card
                  key={k}
                  title={byKey[k]?.name || label}
                  price={(byKey[k]?.price || "").replace(/^\s*$/, "")}
                  features={byKey[k]?.features}
                  onPrimary={openStripe}
                  onSecondary={openStripe}
                  secondaryLabel="Buy Now"
                />
              ))}
            </div>
            <div className="mt-4 text-xs text-[color:var(--muted)]">
              Tip: You can add/remove Webinars, Courses, and Coaching on the next page before confirming.
            </div>
          </div>
        </div>

        {/* Build-Your-Plan (now just funnels to the same Stripe page) */}
        <div className="mt-8 rounded-xl border border-white/10 p-6 bg-[color:var(--card)]">
          <h2 className="text-xl font-semibold">Build your plan</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Choose add-ons on the hosted checkout page (Webinars, Courses, Coaching).
          </p>

          <div className="mt-6">
            <button
              onClick={openStripe}
              className="px-5 py-2.5 rounded-xl bg-[color:var(--accent)] hover:opacity-90 font-semibold"
              style={{ color: "#0b0b10" }}
            >
              Go to Checkout
            </button>
          </div>

          <div className="mt-4 text-xs text-[color:var(--muted)]">
            <p>
              Disclosures: Webinars/Courses are educational only; not investment advice. Trading involves risk; past
              performance does not guarantee future results. Features and availability may change.
            </p>
            <p className="mt-2">
              Subscriptions auto-renew monthly; cancel anytime. Cancellations take effect at the end of the current
              billing period. No refunds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
