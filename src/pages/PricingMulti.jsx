// src/pages/PricingMulti.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";

console.log("Pricing MULTI loaded (register-first flow, compact)");

// Fallback prices so we always render numbers
const FALLBACK = {
  app:      { price: "$10.00",  cadence: "mo" },
  webinars: { price: "$100.00", cadence: "mo" },
  courses:  { price: "$20.00",  cadence: "mo" },
  coaching: { price: "$100.00", cadence: "mo" },
  community:{ price: "$20.00",  cadence: "mo" }, // NEW fallback
};

function Badge({ children }) {
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-lg border"
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

function Price({ value, cadence = "mo" }) {
  const s = String(value ?? "").trim();
  if (!s) {
    return (
      <div className="mt-1 text-xl font-semibold">
        —<span className="text-xs font-medium text-[color:var(--muted)]">/ {cadence}</span>
      </div>
    );
  }
  const m = s.match(/^(\$)?\s*([0-9]+(?:\.[0-9]{2})?)$/);
  if (!m) {
    return (
      <div className="mt-1 text-xl font-semibold">
        {s}<span className="text-xs font-medium text-[color:var(--muted)]">/ {cadence}</span>
      </div>
    );
  }
  const [, sym = "$", amt = "0.00"] = m;
  return (
    <div className="mt-1 flex items-end gap-1">
      <span className="text-sm opacity-80">{sym}</span>
      <span className="text-3xl font-extrabold leading-none tracking-tight">
        {amt.replace(/\.00$/, "")}
      </span>
      <span className="text-xs font-medium text-[color:var(--muted)]">/ {cadence}</span>
    </div>
  );
}

function Card({ title, price, cadence, features, onPrimary, note }) {
  return (
    <div className="rounded-lg border border-white/10 p-4 bg-[color:var(--card)] text-white flex flex-col">
      <div className="text-[15px] font-semibold">{title}</div>
      <Price value={price} cadence={cadence} />
      <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed">
        {features?.map((f, i) => <li key={i}>• {f}</li>)}
      </ul>
      {note && <div className="text-[11px] text-[color:var(--muted)] mt-2">{note}</div>}
      <button
        onClick={onPrimary}
        className="mt-3 w-full text-center font-semibold py-1.5 rounded bg-[color:var(--accent)] hover:opacity-90 text-[14px]"
        style={{ color: "#0b0b10" }}
      >
        Register to Subscribe
      </button>
    </div>
  );
}

export default function PricingMulti() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState([]);

  const goRegister = () => navigate("/register");

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

  const priceFor   = (k) => (byKey[k]?.price && byKey[k].price !== "—") ? byKey[k].price : (FALLBACK[k]?.price || "—");
  const cadenceFor = (k) => byKey[k]?.cadence || (FALLBACK[k]?.cadence || "mo");

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-6xl text-white">
        {/* Header */}
        <div className="rounded-lg border border-white/10 p-5 bg-[color:var(--card)]">
          <h1 className="text-[22px] md:text-[26px] font-semibold mb-1">Quantum Edge</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Journal, analytics, psych profile, TraderLab &amp; more—built for serious traders.
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Badge>Cancel anytime</Badge>
            <Badge>Secure checkout</Badge>
            <Badge>Instant access</Badge>
          </div>
          <div className="mt-3 text-[12px] text-yellow-300/90">
            <strong>Note:</strong> The <b>QuantumEdge App ($10/mo)</b> is required and works hand-in-hand with Webinars, Courses, and Coaching.
            Create your account first, then complete payment.
          </div>
        </div>

        {/* Cards (more compact) */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card
            title={byKey.app?.name || "QuantumEdge App"}
            price={priceFor("app")}
            cadence={cadenceFor("app")}
            features={byKey.app?.features || ["TraderLab & Journal","Backtesting + Analytics","Alerts, Watchlist, Intel"]}
            onPrimary={goRegister}
            note="Required"
          />
          <Card
            title={byKey.webinars?.name || "Live Webinars"}
            price={priceFor("webinars")}
            cadence={cadenceFor("webinars")}
            features={byKey.webinars?.features || ["Live sessions + Q&A","Replays when available","Session notes/links"]}
            onPrimary={goRegister}
          />
          <Card
            title={byKey.courses?.name || "Courses"}
            price={priceFor("courses")}
            cadence={cadenceFor("courses")}
            features={byKey.courses?.features || ["Self-paced lessons","Strategy + psychology drills","Journaling workflows"]}
            onPrimary={goRegister}
          />
          <Card
            title={byKey.coaching?.name || "Coaching / Mentorship"}
            price={priceFor("coaching")}
            cadence={cadenceFor("coaching")}
            features={byKey.coaching?.features || ["1:1 or small group","Personalized feedback","Accountability plan"]}
            onPrimary={goRegister}
          />
        </div>

        {/* NEW ROW: Community Chat card */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card
            title={byKey.community?.name || "Trader Community Chat"}
            price={priceFor("community")}
            cadence={cadenceFor("community")}
            features={byKey.community?.features || ["Private chat & trade rooms","Daily Q&A & peer support","Member-only alerts/discussions"]}
            onPrimary={goRegister}
          />
        </div>

        {/* Register-first CTA */}
        <div className="mt-5 rounded-lg border border-white/10 p-5 bg-[color:var(--card)]">
          <h2 className="text-[18px] font-semibold">Ready to get started?</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            First, <b>create your account</b>. After registration, you’ll be guided to select your subscription and complete payment.
            The App is required; add Webinars, Courses, or Coaching during checkout.
          </p>
          <button
            onClick={goRegister}
            className="mt-3 px-5 py-2.5 rounded-xl bg-[color:var(--accent)] hover:opacity-90 font-semibold"
            style={{ color: "#0b0b10" }}
          >
            Register & Continue
          </button>
          <div className="mt-3 text-[11px] text-[color:var(--muted)]">
            Use the <b>same email</b> on registration and checkout for smooth access. Subscriptions auto-renew monthly; cancel anytime.
          </div>
        </div>
      </div>
    </div>
  );
}
