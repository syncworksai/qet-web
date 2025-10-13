// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";

import MarketClocks from "../components/MarketClocks";
import Watchlist from "../components/Watchlist";
import LiteChart from "../components/LiteChart";
import NewsFeed from "../components/NewsFeed";
import ForexCalendar from "../components/ForexCalendar";
import AlertCenter from "../components/AlertCenter";

/* ===================== THEME / TOKENS ===================== */
function cssVar(name, fb = "") {
  if (typeof window === "undefined") return fb;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
}
const TOKENS_FALLBACK = {
  primary: "#6366f1",
  accent: "#06b6d4",
  emerald: "#10b981",
  muted: "#9aa8bd",
  grid: "#243044",
  card: "#0B0F19",
  cardSoft: "rgba(255,255,255,0.02)",
  ring: "rgba(255,255,255,0.10)",
};
function useTokens() {
  const [t, setT] = useState(TOKENS_FALLBACK);
  useEffect(() => {
    setT({
      primary: cssVar("--color-primary", TOKENS_FALLBACK.primary),
      accent: cssVar("--color-accent", TOKENS_FALLBACK.accent),
      emerald: cssVar("--color-success", TOKENS_FALLBACK.emerald),
      muted: cssVar("--color-muted", TOKENS_FALLBACK.muted),
      grid: cssVar("--color-grid", TOKENS_FALLBACK.grid),
      card: cssVar("--card", TOKENS_FALLBACK.card) || TOKENS_FALLBACK.card,
      cardSoft: TOKENS_FALLBACK.cardSoft,
      ring: TOKENS_FALLBACK.ring,
    });
  }, []);
  return t;
}
const shadowXL = "0 20px 70px rgba(0,0,0,.45)";
const divider = "linear-gradient(90deg, transparent, rgba(255,255,255,.075), transparent)";

/* ===================== CONSTANT LINKS ===================== */
const LINKS = {
  pricing: "https://qet-web.vercel.app/pricing",
  groupme: "https://groupme.com/join_group/110861155/abrXDGzA",
  discord: "https://discord.gg/AnNCXCef",
};

/* ===================== UI ATOMS ===================== */
function Section({ icon, title, subtitle, right, children, className, bodyClass, tone = "default" }) {
  const t = useTokens();

  const tones = {
    default: {
      bg: t.card,
      headBg: "linear-gradient(180deg, rgba(255,255,255,.05), transparent)",
      border: t.grid,
      halo: `0 1px 0 0 ${t.ring} inset`,
    },
    accent: {
      bg: `linear-gradient(180deg, rgba(99,102,241,.08), rgba(6,182,212,.06))`,
      headBg: "linear-gradient(180deg, rgba(99,102,241,.12), transparent)",
      border: "rgba(99,102,241,.35)",
      halo: `0 1px 0 0 rgba(99,102,241,.3) inset`,
    },
  };
  const c = tones[tone] || tones.default;

  return (
    <section
      className={`rounded-2xl border overflow-hidden ${className || ""}`}
      style={{ borderColor: c.border, background: c.bg, boxShadow: shadowXL }}
    >
      <header
        className="px-4 md:px-5 pt-4 pb-3 flex items-start justify-between gap-3"
        style={{ background: c.headBg, boxShadow: c.halo }}
      >
        <div>
          <div className="flex items-center gap-2">
            {icon && (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-white/85 ring-1 ring-white/10">
                {icon}
              </span>
            )}
            <h2 className="text-sm md:text-[15px] font-semibold tracking-wide text-white/90">
              {title}
            </h2>
          </div>
          {subtitle && <p className="text-xs mt-1 text-white/60">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="h-px w-full" style={{ backgroundImage: divider }} />
      <div className={`p-4 md:p-5 ${bodyClass || ""}`}>{children}</div>
    </section>
  );
}

function PillLink({ href, children, tone = "default", title }) {
  const t = useTokens();
  const styles =
    tone === "primary"
      ? { background: "rgba(99,102,241,.15)", color: "#c7c9ff", borderColor: "rgba(99,102,241,.35)" }
      : tone === "emerald"
      ? { background: "rgba(16,185,129,.15)", color: "#b6f3dc", borderColor: "rgba(16,185,129,.35)" }
      : { background: "rgba(255,255,255,.06)", color: "#e5e7eb", borderColor: t.grid };
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      className="px-3 py-1.5 rounded-full text-xs border hover:opacity-95 transition"
      style={styles}
    >
      {children}
    </a>
  );
}

/* ===================== QE NEWS (Teacher announcements) ===================== */
function QuantumEdgeNewsPanel() {
  const t = useTokens();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/internal/news/");
        const list = res?.data?.items || res?.data || [];
        if (ok) setItems(Array.isArray(list) ? list : []);
      } catch {
        if (ok) setItems([]);
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  return (
    <Section
      title="Quantum Edge News"
      subtitle="Announcements • changes • roadmap • maintenance"
      icon={<span className="text-xs">📣</span>}
      tone="accent"
      bodyClass="space-y-4"
      right={
        <div className="hidden md:flex items-center gap-2">
          <PillLink href={LINKS.pricing} tone="primary" title="Pricing & plans">
            Pricing
          </PillLink>
          <PillLink href={LINKS.groupme} tone="emerald" title="Join GroupMe">
            Join GroupMe
          </PillLink>
          <PillLink href={LINKS.discord} tone="emerald" title="Join Discord">
            Join Discord
          </PillLink>
        </div>
      }
    >
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10 w-2/3" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-white/80">No internal updates yet.</div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id ?? `${n.title}-${n.created_at}`}
              className="rounded-xl border p-3 md:p-4"
              style={{ borderColor: t.grid, background: t.cardSoft }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-white/95 truncate">
                    {n.title || "Update"}
                  </div>
                  {n.body && (
                    <div className="text-sm text-white/75 mt-1 whitespace-pre-wrap leading-relaxed">
                      {n.body}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-[11px] text-white/55 text-right">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ===================== PAGE ===================== */
const DEFAULT_ACTIVE = { symbol: "XAUUSD", asset_type: "forex" };

export default function Dashboard() {
  const t = useTokens();
  const [active, setActive] = useState(DEFAULT_ACTIVE);
  const [alertOpen, setAlertOpen] = useState(false);

  const headerTitle = useMemo(() => {
    const s = (active?.symbol || "").toUpperCase();
    const at = (active?.asset_type || "").toUpperCase();
    return s ? `${s} · ${at}` : "Dashboard";
  }, [active]);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAlertOpen(true)}
            className="px-3 py-2 rounded-xl text-sm text-white bg-white/5 hover:bg-white/10 border"
            style={{ borderColor: t.grid }}
          >
            Alert Center
          </button>
        </div>
      </div>

      {/* Market clocks */}
      <MarketClocks />

      {/* 1) QE NEWS — top & prominent */}
      <QuantumEdgeNewsPanel />

      {/* 2) **SWAPPED** FOREX CALENDAR (LEFT, WIDE) + MARKET NEWS (RIGHT, NARROW) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: Calendar (2/3) */}
        <div className="xl:col-span-2">
          <Section
            title="Forex Calendar"
            subtitle="Upcoming events and expected impact"
            icon={<span className="text-xs">🗓️</span>}
          >
            <ForexCalendar />
          </Section>
        </div>

        {/* RIGHT: Market News (1/3) */}
        <div className="xl:col-span-1">
          <Section
            title="Market News"
            subtitle={headerTitle}
            icon={<span className="text-xs">📰</span>}
            right={
              <div className="hidden md:flex items-center gap-2 text-xs text-white/60">
                <span className="h-2 w-2 rounded-full bg-emerald-400/85" /> Live
              </div>
            }
            bodyClass="p-0"
          >
            <div className="max-h-[62vh] overflow-auto p-4 md:p-5">
              <NewsFeed symbol={active?.symbol} assetType={active?.asset_type} />
            </div>
          </Section>
        </div>
      </div>

      {/* 3) CHART (LARGE) + WATCHLIST (SMALLER) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart: 2/3 width on xl */}
        <div className="xl:col-span-2">
          <Section
            title="Chart"
            subtitle="Lightweight chart for quick analysis"
            icon={<span className="text-xs">📊</span>}
            bodyClass="p-0"
          >
            <div className="p-4 md:p-5">
              <div className="rounded-xl overflow-hidden ring-1 ring-white/10">
                <LiteChart active={active} />
              </div>
            </div>
          </Section>
        </div>

        {/* Watchlist: 1/3 width on xl */}
        <div className="xl:col-span-1">
          <Section
            title="Watchlist"
            subtitle="Click any symbol to load the chart"
            icon={<span className="text-xs">📈</span>}
          >
            <div className="rounded-xl border" style={{ borderColor: t.grid, background: t.cardSoft }}>
              <Watchlist onSelectSymbol={(s) => s && setActive(s)} />
            </div>
          </Section>
        </div>
      </div>

      {/* Overlays */}
      <AlertCenter open={alertOpen} onClose={() => setAlertOpen(false)} />
    </div>
  );
}
