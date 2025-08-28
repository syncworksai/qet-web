// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/axios";

import MarketClocks from "../components/MarketClocks";
import KPICard from "../components/KPICard";
import Watchlist from "../components/Watchlist";
import ChartCard from "../components/ChartCard";
import NewsFeed from "../components/NewsFeed";
import ForexCalendar from "../components/ForexCalendar";
import AlertCenter from "../components/AlertCenter";

import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

/* ---------------- color tokens ---------------- */
function readCssVar(name) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function fallbackTokens() {
  return {
    primary: "#4f46e5",
    secondary: "#7c3aed",
    accent: "#06b6d4",
    success: "#10b981",
    danger: "#ef4444",
    warning: "#f59e0b",
    info: "#0ea5e9",
    muted: "#94a3b8",
    grid: "#1f2937",
    charts: ["#4f46e5","#22c55e","#eab308","#ef4444","#06b6d4","#a855f7","#f97316","#14b8a6"],
  };
}
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function useColorTokens() {
  const [tokens, setTokens] = useState(fallbackTokens());
  useEffect(() => {
    const fb = fallbackTokens();
    const charts = [];
    for (let i = 1; i <= 8; i++) {
      const v = readCssVar(`--chart-${i}`);
      if (v) charts.push(v);
    }
    setTokens({
      primary: readCssVar("--color-primary") || fb.primary,
      secondary: readCssVar("--color-secondary") || fb.secondary,
      accent: readCssVar("--color-accent") || fb.accent,
      success: readCssVar("--color-success") || fb.success,
      danger: readCssVar("--color-danger") || fb.danger,
      warning: readCssVar("--color-warning") || fb.warning,
      info: readCssVar("--color-info") || fb.info,
      muted: readCssVar("--color-muted") || fb.muted,
      grid: readCssVar("--color-grid") || fb.grid,
      charts: charts.length ? charts : fb.charts,
    });
  }, []);
  return tokens;
}

/* ---------------- helpers ---------------- */
const DEFAULT_ACTIVE = { symbol: "AAPL", asset_type: "stock" };
const fmtUSD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/^\((.*)\)$/, "$1").replace(/[,$\s]/g, "").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] ?? "—";
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

/* ---------------- page ---------------- */
export default function Dashboard() {
  const tokens = useColorTokens();

  const [active, setActive] = useState(DEFAULT_ACTIVE);
  const [alertOpen, setAlertOpen] = useState(false);

  const [headline, setHeadline] = useState(null);
  const [loadingHeadline, setLoadingHeadline] = useState(true);

  const [tlTrades, setTlTrades] = useState([]);
  const [loadingTL, setLoadingTL] = useState(true);

  const headerTitle = useMemo(() => {
    const s = (active?.symbol || "").toUpperCase();
    const t = (active?.asset_type || "").toUpperCase();
    return s ? `${s} · ${t}` : "Dashboard";
  }, [active]);

  // headline analytics
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setLoadingHeadline(true);
        const res = await api.get("/api/journal/analytics/");
        if (!ok) return;
        setHeadline(res.data?.headline || null);
      } catch (e) {
        console.error("headline analytics failed", e);
      } finally {
        if (ok) setLoadingHeadline(false);
      }
    })();
    return () => { ok = false; };
  }, []);

  // TraderLab snapshot
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setLoadingTL(true);
        const { data: runs } = await api.get("/api/journal/backtests/runs/");
        const tl = (runs || []).find(r => /^TraderLab/i.test(r.name));
        if (!tl) { if (ok) setTlTrades([]); return; }
        const { data: trades } = await api.get(`/api/journal/backtests/trades/?run=${tl.id}`);
        if (ok) setTlTrades(trades || []);
      } catch (e) {
        console.error("Failed to load TraderLab snapshot", e);
        if (ok) setTlTrades([]);
      } finally {
        if (ok) setLoadingTL(false);
      }
    })();
    return () => { ok = false; };
  }, []);

  // derived snapshot
  const derived = useMemo(() => {
    const rows = (tlTrades || []).map(t => ({
      id: t.id,
      symbol: t.symbol || "—",
      trade_time: t.trade_time || null,
      pnl: toNum(t.net_pnl) ?? null,
    }));

    const bySymbol = groupBy(rows, "symbol");
    const perSymbol = Object.entries(bySymbol).map(([symbol, list]) => {
      const netPnL = list.reduce((s, r) => s + (r.pnl ?? 0), 0);
      const wins = list.filter((r) => (r.pnl ?? 0) > 0).length;
      const count = list.length;
      return {
        symbol,
        trades: count,
        wins,
        winRate: count ? (wins / count) * 100 : 0,
        netPnL,
      };
    }).sort((a,b)=>Math.abs(b.netPnL)-Math.abs(a.netPnL));

    let pieData = perSymbol.map((s) => ({ name: s.symbol, value: Math.abs(s.netPnL) }))
      .filter(d => Number.isFinite(d.value) && d.value > 0);
    if (pieData.length === 0 && perSymbol.length > 0) {
      pieData = perSymbol.map((s) => ({ name: s.symbol, value: Math.max(1, s.trades) }));
    }
    const barData = perSymbol.map((s) => ({ symbol: s.symbol, pnl: Number((s.netPnL ?? 0).toFixed(2)) })).slice(0, 12);

    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, wins: 0, total: 0 }));
    rows.forEach((r) => {
      if (!r.trade_time) return;
      const hh = Number(String(r.trade_time).split(":")[0]);
      if (!Number.isFinite(hh) || hh < 0 || hh > 23) return;
      hourBuckets[hh].total += 1;
      if ((r.pnl ?? 0) > 0) hourBuckets[hh].wins += 1;
    });
    const hourData = hourBuckets.map((b) => ({
      hour: b.hour,
      winRate: b.total ? (b.wins / b.total) * 100 : 0,
      total: b.total,
    }));
    const bestHour = hourData.reduce(
      (acc, b) => (b.total > 0 && (b.winRate > acc.winRate || (b.winRate === acc.winRate && b.total > acc.total))) ? b : acc,
      { hour: null, winRate: -1, total: 0 }
    );

    return { pieData, barData, hourData, bestHour };
  }, [tlTrades]);

  const selectionBg = hexToRgba(tokens.accent, 0.35);
  const darkTooltip = {
    borderRadius: 12,
    borderColor: tokens.grid,
    background: "rgba(15,17,21,0.98)",
    color: "#e5e7eb",
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 space-y-5">
      <style>{`::selection { background: ${selectionBg}; }`}</style>

      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-100">Dashboard</h1>
          <p className="text-sm" style={{ color: tokens.muted }}>{headerTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAlertOpen(true)}
            className="px-3 py-2 rounded-xl border text-neutral-200 hover:text-neutral-100 bg-transparent"
            style={{ border:`1px solid ${hexToRgba(tokens.accent,0.55)}` }}
          >
            Alert Center
          </button>
          <Link to="/traderlab" className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-600 text-neutral-200 hover:text-neutral-100">
            TraderLab
          </Link>
          <Link to="/backtesting" className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-600 text-neutral-200 hover:text-neutral-100">
            Backtesting
          </Link>
          <Link to="/psych-quiz" className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-600 text-neutral-200 hover:text-neutral-100">
            Psych Quiz
          </Link>
          <Link to="/journal" className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-600 text-neutral-200 hover:text-neutral-100">
            Journal
          </Link>
          <Link to="/courses" className="px-3 py-2 rounded-xl border border-neutral-700 hover:border-neutral-600 text-neutral-200 hover:text-neutral-100">
            Courses
          </Link>
        </div>
      </div>

      {/* One-line clocks */}
      <MarketClocks />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="Trades" value={loadingHeadline ? "…" : (headline?.total_trades ?? "—")} />
        <KPICard label="Win rate" value={loadingHeadline ? "…" : `${(headline?.win_rate ?? 0).toFixed(1)}%`} />
        <KPICard label="Net P&L" value={loadingHeadline ? "…" : fmtUSD.format(headline?.net_pnl ?? 0)} accent />
        <KPICard label="Avg Win" value={loadingHeadline ? "…" : fmtUSD.format(headline?.avg_win ?? 0)} />
        <KPICard label="Avg Loss" value={loadingHeadline ? "…" : fmtUSD.format(headline?.avg_loss ?? 0)} />
        <KPICard label="Expectancy" value={loadingHeadline ? "…" : fmtUSD.format(headline?.expectancy ?? 0)} />
        <KPICard label="Max Drawdown" value={loadingHeadline ? "…" : fmtUSD.format(headline?.max_drawdown ?? 0)} />
      </div>

      {/* Performance snapshot (TraderLab) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl p-4 overflow-hidden border border-neutral-800 bg-[color:var(--card,#0B0B10)]">
          <div className="text-sm mb-1 text-neutral-400">Profit Share (TraderLab)</div>
          <div className="text-xs mb-2 text-neutral-500">
            {loadingTL ? "Loading…" : (derived.pieData.length ? "Share of abs P&L by symbol" : "No P&L yet — equalized by activity")}
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={derived.pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={42} paddingAngle={2}>
                  {derived.pieData.map((_, i) => (
                    <Cell key={i} stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill={tokens.charts[i % tokens.charts.length]} />
                  ))}
                </Pie>
                <ReTooltip contentStyle={darkTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl p-4 overflow-hidden border border-neutral-800 bg-[color:var(--card,#0B0B10)]">
          <div className="text-sm mb-2 text-neutral-400">P&L by Symbol (TraderLab)</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={derived.barData}>
                <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
                <XAxis dataKey="symbol" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <ReTooltip formatter={(v) => fmtUSD.format(v)} contentStyle={darkTooltip} />
                <Bar dataKey="pnl">
                  {derived.barData.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? tokens.success : tokens.danger} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hour-of-day snapshot */}
      <div className="rounded-2xl p-4 overflow-hidden border border-neutral-800 bg-[color:var(--card,#0B0B10)]">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-400">Trading Hours · win%</div>
          <div className="text-xs text-neutral-500">
            Best hour:&nbsp;
            {derived.bestHour.hour === null ? "—" :
              `${String(derived.bestHour.hour).padStart(2,"0")}:00–${String((derived.bestHour.hour+1)%24).padStart(2,"0")}:00`}
            {derived.bestHour.hour !== null && ` • ${derived.bestHour.winRate.toFixed(0)}% on ${derived.bestHour.total} trades`}
          </div>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={derived.hourData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickFormatter={(h) => String(h).padStart(2,"0")} stroke="#9ca3af" />
              <YAxis domain={[0,100]} tickFormatter={(v)=>`${v}%`} stroke="#9ca3af" />
              <ReTooltip formatter={(v,n,p)=>[`${(v ?? 0).toFixed?.(0) ?? v}%`, `${String(p?.payload?.hour).padStart(2,"0")}:00`]} contentStyle={darkTooltip} />
              <Bar dataKey="winRate">
                {(derived.hourData||[]).map((d,i)=>{
                  const rate=d.winRate||0; let color=tokens.danger;
                  if (rate>=80) color=tokens.success; else if (rate>=60) color="#facc15"; else if (rate>=40) color="#f97316";
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main content: Chart + Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl p-4 overflow-hidden border border-neutral-800 bg-[color:var(--card,#0B0B10)]">
          <div className="text-sm uppercase tracking-wide mb-3 text-neutral-400">Chart</div>
          <ChartCard active={active} />
        </div>
        <div className="lg:col-span-1">
          <Watchlist onSelectSymbol={(s) => s && setActive(s)} />
        </div>
      </div>

      {/* Forex Calendar (full width) */}
      <div>
        <div className="text-sm uppercase tracking-wide mb-3 text-neutral-400">Forex Calendar</div>
        <ForexCalendar />
      </div>

      {/* News (full width) */}
      <div className="rounded-2xl p-4 overflow-hidden border border-neutral-800">
        <div className="text-sm uppercase tracking-wide mb-3 text-neutral-400">News</div>
        <div className="max-h-[680px] overflow-auto pr-1">
          <NewsFeed symbol={active?.symbol} assetType={active?.asset_type} />
        </div>
      </div>

      {/* Alert Center */}
      <AlertCenter open={alertOpen} onClose={() => setAlertOpen(false)} />
    </div>
  );
}
