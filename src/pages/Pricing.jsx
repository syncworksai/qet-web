// src/pages/Pricing.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";

// Debug marker so you can confirm this component is actually loaded
console.log("Pricing MULTI loaded");

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

function Card({ title, price, cadence, features, onPrimary, onSecondary, secondaryLabel = "Buy Now" }) {
  return (
    <div className="rounded-xl border border-white/10 p-6 bg-[color:var(--card)] text-white flex flex-col">
      <div className="text-xl font-semibold">{title}</div>
      <div className="mt-2 text-4xl font-bold">
        {price}
        {price !== "—" && <span className="text-base font-medium text-[color:var(--muted)]">/mo</span>}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {features?.map((f, i) => <li key={i}>• {f}</li>)}
      </ul>

      <div className="mt-6 grid gap-3">
        {/* Primary: ALWAYS route to /register, not Stripe */}
        <button
          onClick={onPrimary}
          className="w-full text-center font-semibold py-2 rounded bg-[color:var(--accent)] hover:opacity-90"
          style={{ color: "#0b0b10" }}
        >
          Subscribe
        </button>

        {/* Secondary: optional “Buy Now” opens Payment Link */}
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

export default function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState([]);
  // Default bundle: App + Webinars + Courses (no Coaching)
  const [selected, setSelected] = useState({ app: true, webinars: true, courses: true, coaching: false });

  // Safety net: if any legacy Stripe <a> sneaks into the DOM, hijack it to /register.
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); navigate("/register"); };
    const anchors = Array.from(document.querySelectorAll('a[href*="stripe.com"]'));
    anchors.forEach((a) => a.addEventListener("click", handler));
    return () => anchors.forEach((a) => a.removeEventListener("click", handler));
  }, [navigate]);

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

  const toggle = (k) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  const onBundleCheckout = async () => {
    const items = Object.keys(selected).filter((k) => selected[k]);
    if (!items.length) return alert("Pick at least one option.");

    const missing = items.filter((k) => !byKey[k]?.price_id);
    if (missing.length) {
      alert(`Missing Stripe Price IDs for: ${missing.join(", ")}. Set PRICE_* env on backend or use individual Buy Now.`);
      return;
    }

    try {
      const r = await api.post("/billing/checkout/bundle/", { items });
      const url = r.data?.checkout_url;
      if (url) window.location.href = url;
      else alert("Could not create checkout. Please try again.");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || "Checkout error.");
    }
  };

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

          {/* Product cards from backend */}
          <div className="rounded-xl border border-white/10 p-6 bg-[color:var(--card)]">
            <div className="grid md:grid-cols-2 gap-4">
              {pricing.map((p) => (
                <Card
                  key={p.key}
                  title={p.name}
                  price={p.price}
                  cadence={p.cadence}
                  features={p.features}
                  onPrimary={() => navigate("/register")} // primary: /register
                  onSecondary={p.payment_link ? () => window.open(p.payment_link, "_blank", "noopener") : undefined}
                  secondaryLabel={p.payment_link ? "Buy Now" : undefined}
                />
              ))}
            </div>
            <div className="mt-4 text-xs text-[color:var(--muted)]">
              Tip: Use the <b>same email</b> on checkout and registration for smooth access.
            </div>
          </div>
        </div>

        {/* Build-Your-Plan */}
        <div className="mt-8 rounded-xl border border-white/10 p-6 bg-[color:var(--card)]">
          <h2 className="text-xl font-semibold">Build your plan</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Example: App + Webinars + Courses (no Coaching). We’ll bundle them into one checkout.
          </p>

          <div className="mt-4 grid md:grid-cols-4 gap-3">
            {["app", "webinars", "courses", "coaching"].map((k) => (
              <label key={k} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={!!selected[k]} onChange={() => toggle(k)} className="w-5 h-5" />
                <div>
                  <div className="font-medium">{byKey[k]?.name || k}</div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {byKey[k]?.price_id ? "Bundle-ready" : "Set PRICE_* env"}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6">
            <button
              onClick={onBundleCheckout}
              className="px-5 py-2.5 rounded-xl bg-[color:var(--accent)] hover:opacity-90 font-semibold"
              style={{ color: "#0b0b10" }}
            >
              Checkout Bundle
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
