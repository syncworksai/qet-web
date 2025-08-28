// src/pages/TraderLab.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { api } from "../api/axios";
import JournalPanel from "../components/JournalPanel";

/* ---------------- icons (inline SVG) ---------------- */
function IconButton({ title, onClick, children, style, className = "" }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-2 rounded-xl border hover:opacity-90 ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}
const SaveIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 3h10l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke={color} strokeWidth="1.5"/>
    <path d="M7 3v6h8V3" stroke={color} strokeWidth="1.5"/>
    <rect x="7" y="13" width="10" height="6" rx="1.5" stroke={color} strokeWidth="1.5"/>
  </svg>
);
const TrashIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 7h16" stroke={color} strokeWidth="1.5"/>
    <path d="M10 3h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1z" stroke={color} strokeWidth="1.5"/>
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke={color} strokeWidth="1.5"/>
    <path d="M10 11v6M14 11v6" stroke={color} strokeWidth="1.5"/>
  </svg>
);

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
    grid: "#1f2937", // dark border
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
const fmtMoney = (v) =>
  (v ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/* ---- FX assist helpers ---- */
function parseFx(symRaw) {
  if (!symRaw) return null;
  const s = String(symRaw).toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z]{6}$/.test(s)) return { base: s.slice(0,3), quote: s.slice(3) };
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(s)) return { base: s.slice(0,3), quote: s.slice(4,7) };
  return null;
}
function pipSizeFor(quote) {
  return quote === "JPY" ? 0.01 : 0.0001;
}
function fxDecimalsFor(quote) {
  return quote === "JPY" ? 3 : 5;
}

/* ---- Row background helpers (dark hover) ---- */
function rowBgs(tokens) {
  return {
    base: hexToRgba(tokens.accent, 0.06),
    hover: hexToRgba(tokens.accent, 0.12),
  };
}

/* ---- Notes parsing (SL/TP/STRAT/MODE) ---- */
function parseMetaFromNotes(notes) {
  const out = { sl: null, tp: null, strategy: null, mode: null };
  if (!notes) return out;
  const text = String(notes);

  const mSL = text.match(/(?:^|\b)SL:\s*([0-9.]+)/i);
  if (mSL) out.sl = toNum(mSL[1]);

  const mTP = text.match(/(?:^|\b)TP:\s*([0-9.]+)/i);
  if (mTP) out.tp = toNum(mTP[1]);

  const mStrat = text.match(/STRAT(?:EGY)?:\s*([^|]+?)(?:\s*\||$)/i);
  if (mStrat) out.strategy = mStrat[1].trim();

  const mMode = text.match(/MODE:\s*([^|]+?)(?:\s*\||$)/i);
  if (mMode) out.mode = mMode[1].trim().toUpperCase();

  return out;
}

/* ---------------- page ---------------- */
export default function TraderLab() {
  const tokens = useColorTokens();

  const [runId, setRunId] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);

  // run meta (editable)
  const [runMeta, setRunMeta] = useState({ name: "TraderLab", initial_capital: "", notes: "" });
  const [savingRun, setSavingRun] = useState(false);
  const [deletingRun, setDeletingRun] = useState(false);

  // CSV preview
  const [csvPreviewRows, setCsvPreviewRows] = useState(null);
  const [csvFile, setCsvFile] = useState(null);

  // attachments
  const [imageUploading, setImageUploading] = useState(null);
  const fileInputRef = useRef(null);

  // manual form
  const [form, setForm] = useState({
    date: "",
    trade_time: "",
    symbol: "",
    direction: "long",
    size: "",
    entry_price: "",
    stop_price: "",
    target_price: "",
    fee: "",
    notes: "",
    strategy: "",
  });
  const [formAttachment, setFormAttachment] = useState(null);

  // FX Assist (client-side)
  const [fxCfg, setFxCfg] = useState({
    enabled: false,
    pipUSD: "10",
    sizeIsLots: true,
    preset: "AUTO"
  });

  // Risk config (non-FX per-point + risk $/trade)
  const [riskCfg, setRiskCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem("qe.riskCfg.traderlab") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    const merged = {
      riskPerTradeUSD: riskCfg?.riskPerTradeUSD ?? "100",
      perPointUSD: riskCfg?.perPointUSD ?? "1",
    };
    if (JSON.stringify(merged) !== JSON.stringify(riskCfg)) setRiskCfg(merged);
    localStorage.setItem("qe.riskCfg.traderlab", JSON.stringify(merged));
  }, [riskCfg]);

  // ensure a single TraderLab run exists
  useEffect(() => {
    (async () => {
      try {
        const { data:runs } = await api.get("/api/journal/backtests/runs/");
        let run = (runs || []).find(r => /^TraderLab/i.test(r.name));
        if (!run) {
          const res = await api.post("/api/journal/backtests/runs/", { name: "TraderLab" });
          run = res.data;
        }
        setRunId(run.id);
        setRunMeta({
          name: run.name || "TraderLab",
          initial_capital: String(run.initial_capital ?? ""),
          notes: run.notes || "",
        });
        await loadTrades(run.id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  async function loadTrades(id) {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/journal/backtests/trades/?run=${id}`);
      setTrades(data || []);
    } catch (e) {
      console.error(e);
      setTrades([]);
    } finally { setLoading(false); }
  }

  // compute P&L with optional FX assist
  function computePnL(t) {
    const entry = toNum(t.entry_price);
    const exit  = toNum(t.exit_price);
    const size  = toNum(t.size);
    const fee   = toNum(t.fee) ?? 0;
    if (entry == null || exit == null || size == null) return null;

    const fx = parseFx(t.symbol);
    if (fxCfg.enabled && fx) {
      const pipSz = pipSizeFor(fx.quote);
      const pips = (t.direction === "short" ? (entry - exit) : (exit - entry)) / pipSz;
      const perLotUSD = toNum(fxCfg.pipUSD) ?? 10;
      const lots = fxCfg.sizeIsLots ? (size || 0) : (size / 100000);
      const pnlUSD = (pips * perLotUSD * (lots || 0)) - fee;
      if (Number.isFinite(pnlUSD)) return pnlUSD;
    }
    const gross = (t.direction === "short" ? (entry - exit) * size : (exit - entry) * size);
    return (gross - fee);
  }

  // planned RR and realized R helpers
  function computePlannedRR(t) {
    const entry = toNum(t.entry_price);
    const { sl, tp } = parseMetaFromNotes(t.notes);
    const dir = t.direction;
    if (entry == null || sl == null || tp == null || !dir) return null;

    let riskPts, rewardPts;
    if (dir === "long") {
      riskPts = entry - sl;
      rewardPts = tp - entry;
    } else {
      riskPts = sl - entry;
      rewardPts = entry - tp;
    }
    if (!(Number.isFinite(riskPts) && riskPts > 0)) return null;
    return rewardPts / riskPts;
  }
  function computeOneRUSD(t) {
    const entry = toNum(t.entry_price);
    const size = toNum(t.size);
    const { sl } = parseMetaFromNotes(t.notes);
    if (entry == null || size == null || sl == null) return null;

    const fx = parseFx(t.symbol);
    if (fxCfg.enabled && fx) {
      const pipSz = pipSizeFor(fx.quote);
      const pipsRisk = Math.abs(entry - sl) / pipSz;
      const perLotUSD = toNum(fxCfg.pipUSD) ?? 10;
      const lots = fxCfg.sizeIsLots ? size : (size / 100000);
      const oneR = pipsRisk * perLotUSD * lots;
      return Number.isFinite(oneR) ? oneR : null;
    }
    const perPoint = toNum(riskCfg.perPointUSD) || 1;
    const oneR = Math.abs(entry - sl) * perPoint * size;
    return Number.isFinite(oneR) ? oneR : null;
  }
  function classifyOutcome(plannedRR, realizedR) {
    if (plannedRR == null || realizedR == null) return "—";
    const eps = 0.05;
    if (realizedR >= plannedRR - eps) return "Hit TP";
    if (realizedR <= -1 + eps) return "Hit SL";
    return "Closed early";
  }

  // FX presets (includes GOLD as XAUUSD approx.)
  const FX_PRESETS = [
    { code:"AUTO", label:"Auto/Manual" },
    { code:"EURUSD", label:"EURUSD ($10/pip/lot)", pipUSD: 10, lots:true },
    { code:"GBPUSD", label:"GBPUSD ($10/pip/lot)", pipUSD: 10, lots:true },
    { code:"USDJPY", label:"USDJPY ($9.1/pip/lot)", pipUSD: 9.1, lots:true },
    { code:"XAUUSD", label:"GOLD/XAUUSD ($1.0 per 0.1)$", pipUSD: 10, lots:true },
  ];
  useEffect(() => {
    const p = FX_PRESETS.find(x => x.code === fxCfg.preset);
    if (p && p.code !== "AUTO") {
      setFxCfg(c => ({ ...c, pipUSD: String(p.pipUSD), sizeIsLots: p.lots }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxCfg.preset]);

  // quick actions
  function ratioTarget(ratio) {
    const entry = toNum(form.entry_price);
    const stop = toNum(form.stop_price);
    if (entry == null || stop == null) return;

    const fx = parseFx(form.symbol);
    const decimals = fx ? fxDecimalsFor(fx.quote) : 2;

    if (form.direction === "long") {
      const risk = entry - stop;
      if (risk <= 0) return;
      const target = entry + ratio * risk;
      setForm(f => ({ ...f, target_price: String(target.toFixed(decimals)) }));
    } else {
      const risk = stop - entry;
      if (risk <= 0) return;
      const target = entry - ratio * risk;
      setForm(f => ({ ...f, target_price: String(target.toFixed(decimals)) }));
    }
  }
  function suggestSizeFromRisk() {
    const entry = toNum(form.entry_price);
    const stop = toNum(form.stop_price);
    const risk$ = toNum(riskCfg.riskPerTradeUSD);
    if (entry == null || stop == null || !risk$) return;

    const fx = parseFx(form.symbol);
    if (fxCfg.enabled && fx) {
      const pipSz = pipSizeFor(fx.quote);
      const pipsRisk = Math.abs(entry - stop) / pipSz;
      const perLotUSD = toNum(fxCfg.pipUSD) || 10;
      if (!pipsRisk || !perLotUSD) return;
      const lots = risk$ / (pipsRisk * perLotUSD);
      const val = fxCfg.sizeIsLots ? lots : Math.round(lots * 100000);
      setForm(f => ({ ...f, size: String(Number(val.toFixed(2))) }));
      return;
    }
    const perPoint = toNum(riskCfg.perPointUSD) || 1;
    const size = risk$ / (Math.abs(entry - stop) * perPoint);
    setForm(f => ({ ...f, size: String(Number(size.toFixed(2))) }));
  }

  const derived = useMemo(() => {
    const rows = (trades || []).map((t) => {
      const pnl = computePnL(t);
      const { sl, tp, strategy } = parseMetaFromNotes(t.notes);
      const plannedRR = computePlannedRR(t);
      const oneR = computeOneRUSD(t);
      const realizedR = (oneR && pnl != null) ? (pnl / oneR) : null;
      const outcome = classifyOutcome(plannedRR, realizedR);
      return {
        id: t.id,
        date: t.date,
        trade_time: t.trade_time || null,
        symbol: t.symbol || "—",
        direction: t.direction || "—",
        size: toNum(t.size) ?? null,
        entry: toNum(t.entry_price) ?? null,
        exit: toNum(t.exit_price) ?? null,
        fee: toNum(t.fee) ?? 0,
        pnl: toNum(t.net_pnl) ?? pnl ?? 0,
        notes: t.notes || "",
        attachment: t.attachment || null,
        sl, tp, strategy: strategy || "—",
        plannedRR, realizedR, outcome,
      };
    });

    const bySymbol = groupBy(rows, "symbol");
    const perSymbol = Object.entries(bySymbol).map(([symbol, list]) => {
      const netPnL = list.reduce((s, r) => s + (r.pnl ?? 0), 0);
      const wins = list.filter((r) => (r.pnl ?? 0) > 0).length;
      const losses = list.filter((r) => (r.pnl ?? 0) < 0).length;
      const count = list.length;
      return { symbol, trades: count, wins, losses, winRate: count ? (wins / count) * 100 : 0, netPnL, avgPnL: count ? netPnL / count : 0 };
    });

    const byStrategy = groupBy(rows, "strategy");
    const perStrategy = Object.entries(byStrategy).map(([strategy, list]) => {
      const net = list.reduce((s, r) => s + (r.pnl ?? 0), 0);
      const wins = list.filter(r => (r.pnl ?? 0) > 0).length;
      const count = list.length;
      const avgR = avg(list.map(r => r.realizedR).filter(x => x != null));
      return { strategy, trades: count, wins, winRate: count ? (wins / count) * 100 : 0, netPnL: net, avgR: Number.isFinite(avgR) ? avgR : 0 };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.net += r.pnl ?? 0;
        acc.fee += r.fee ?? 0;
        acc.wins += (r.pnl ?? 0) > 0 ? 1 : 0;
        acc.losses += (r.pnl ?? 0) < 0 ? 1 : 0;
        return acc;
      },
      { net: 0, fee: 0, wins: 0, losses: 0 }
    );
    const winRate = rows.length ? (totals.wins / rows.length) * 100 : 0;

    let pieData = perSymbol.map((s) => ({ name: s.symbol, value: Math.abs(s.netPnL) }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0);
    if (pieData.length === 0 && perSymbol.length > 0) {
      pieData = perSymbol.map((s) => ({ name: s.symbol, value: Math.max(1, s.trades) }));
    }
    const barData = perSymbol.map((s) => ({ symbol: s.symbol, pnl: Number((s.netPnL ?? 0).toFixed(2)) }))
      .filter((d) => Number.isFinite(d.pnl));

    // hours
    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, wins: 0, total: 0 }));
    rows.forEach((r) => {
      if (!r.trade_time) return;
      const hh = Number(String(r.trade_time).split(":")[0]);
      if (!Number.isFinite(hh) || hh < 0 || hh > 23) return;
      hourBuckets[hh].total += 1;
      if ((r.pnl ?? 0) > 0) hourBuckets[hh].wins += 1;
    });
    const hourData = hourBuckets.map((b) => ({ hour: b.hour, winRate: b.total ? (b.wins / b.total) * 100 : 0, total: b.total }));
    const bestHour = hourData.reduce(
      (acc, b) => (b.total > 0 && (b.winRate > acc.winRate || (b.winRate === acc.winRate && b.total > acc.total))) ? b : acc,
      { hour: null, winRate: -1, total: 0 }
    );

    // R buckets (planned RR → bucket: 1,2,3,4)
    const buckets = [1,2,3,4];
    const rStats = buckets.map(B => {
      const planned = rows.filter(r => r.plannedRR != null && nearestBucket(r.plannedRR) === B);
      const trades = planned.length;
      const wins = planned.filter(r => (r.pnl ?? 0) > 0).length;
      const winRateB = trades ? (wins / trades) * 100 : 0;
      const avgRealized = avg(planned.map(r => r.realizedR).filter(x => x != null));
      const hitOrExceed = planned.filter(r => (r.realizedR ?? -999) >= B).length;
      return {
        bucket: B,
        trades,
        wins,
        winRate: winRateB,
        avgRealizedR: Number.isFinite(avgRealized) ? avgRealized : 0,
        achievedGE: hitOrExceed,
      };
    });

    return { rows, perSymbol, perStrategy, totals, winRate, pieData, barData, hourData, bestHour, rStats };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, fxCfg, riskCfg]);

  function nearestBucket(rr) {
    const B = [1,2,3,4];
    return B.reduce((a,b) => Math.abs(rr - b) < Math.abs(rr - a) ? b : a, 1);
  }
  function avg(arr) {
    if (!arr?.length) return NaN;
    const s = arr.reduce((x,y) => x + y, 0);
    return s / arr.length;
  }

  /* -------- run actions -------- */
  async function saveRunMeta() {
    if (!runId) return;
    setSavingRun(true);
    try {
      const payload = {
        name: runMeta.name || "TraderLab",
        initial_capital: runMeta.initial_capital === "" ? 0 : Number(runMeta.initial_capital),
        notes: runMeta.notes || "",
      };
      await api.patch(`/api/journal/backtests/runs/${runId}/`, payload);
    } catch (e) {
      console.error(e);
      alert("Failed to save run.");
    } finally { setSavingRun(false); }
  }
  async function deleteRun() {
    if (!runId) return;
    if (!window.confirm('Delete "TraderLab" and ALL its trades? An empty TraderLab run will be recreated.')) return;
    setDeletingRun(true);
    try {
      await api.delete(`/api/journal/backtests/runs/${runId}/`);
      const res = await api.post("/api/journal/backtests/runs/", { name: "TraderLab" });
      const newRun = res.data;
      setRunId(newRun.id);
      setRunMeta({ name: newRun.name || "TraderLab", initial_capital: String(newRun.initial_capital ?? ""), notes: newRun.notes || "" });
      setTrades([]);
    } catch (e) {
      console.error(e);
      alert("Failed to delete run.");
    } finally { setDeletingRun(false); }
  }

  /* -------- trades / csv / attachments -------- */
  function onCsvSelected(file) {
    if (!file) return;
    setCsvFile(file);
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => setCsvPreviewRows(res.data || []) });
  }
  async function importCsv() {
    if (!csvFile || !runId) return;
    const fd = new FormData();
    fd.append("file", csvFile);
    fd.append("run_id", runId);
    try {
      await api.post("/api/journal/backtests/import_csv/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await loadTrades(runId);
      setCsvFile(null);
      setCsvPreviewRows(null);
    } catch (e) {
      console.error(e);
      alert("Import failed. Check CSV format.");
    }
  }

  async function addTrade(e) {
    e.preventDefault();
    if (!runId) return;
    try {
      const metaBits = [];
      if (form.stop_price) metaBits.push(`SL: ${form.stop_price}`);
      if (form.target_price) metaBits.push(`TP: ${form.target_price}`);
      if (form.strategy) metaBits.push(`STRAT: ${form.strategy}`);
      metaBits.push("MODE: LIVE");
      const combinedNotes = [metaBits.join(" | "), form.notes].filter(Boolean).join(" | ");

      if (formAttachment) {
        const fd = new FormData();
        fd.append("run", runId);
        fd.append("date", form.date || new Date().toISOString().slice(0,10));
        if (form.trade_time) fd.append("trade_time", form.trade_time);
        fd.append("symbol", (form.symbol || "").toUpperCase());
        fd.append("direction", form.direction);
        if (form.size) fd.append("size", form.size);
        if (form.entry_price) fd.append("entry_price", form.entry_price);
        fd.append("exit_price", "");
        fd.append("fee", form.fee || 0);
        fd.append("notes", combinedNotes);
        fd.append("attachment", formAttachment);
        await api.post("/api/journal/backtests/trades/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        await api.post("/api/journal/backtests/trades/", {
          run: Number(runId),
          date: form.date || new Date().toISOString().slice(0,10),
          trade_time: form.trade_time || null,
          symbol: (form.symbol || "").toUpperCase(),
          direction: form.direction,
          size: form.size || null,
          entry_price: form.entry_price || null,
          exit_price: null,
          fee: form.fee || 0,
          notes: combinedNotes,
        });
      }
      await loadTrades(runId);
      setForm({
        date:"", trade_time:"", symbol:"", direction:"long", size:"",
        entry_price:"", stop_price:"", target_price:"", fee:"", notes:"", strategy:"",
      });
      setFormAttachment(null);
    } catch (e) {
      console.error(e);
      alert("Failed to add trade.");
    }
  }

  async function deleteTrade(id) {
    if (!id || !window.confirm("Delete this trade?")) return;
    try {
      await api.delete(`/api/journal/backtests/trades/${id}/`);
      await loadTrades(runId);
    } catch (e) {
      console.error(e);
      alert("Failed to delete trade.");
    }
  }

  async function attachFile(tradeId, file) {
    if (!file || !tradeId) return;
    setImageUploading(tradeId);
    try {
      const fd=new FormData();
      fd.append("attachment", file);
      await api.patch(`/api/journal/backtests/trades/${tradeId}/`, fd, { headers: { "Content-Type":"multipart/form-data" } });
      await loadTrades(runId);
    } catch (e) {
      console.error(e);
      alert("Failed to upload attachment.");
    } finally {
      setImageUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  async function removeAttachment(tradeId) {
    try {
      await api.post(`/api/journal/backtests/trades/${tradeId}/remove-attachment/`);
      await loadTrades(runId);
    } catch (e) {
      console.error(e);
      alert("Failed to remove attachment.");
    }
  }

  const selectionBg = hexToRgba(tokens.accent, 0.35);
  const darkTooltip = {
    borderRadius: 12,
    borderColor: tokens.grid,
    background: "rgba(15,17,21,0.98)",
    color: "#e5e7eb",
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* brand selection color */}
      <style>{`::selection { background: ${selectionBg}; }`}</style>

      {/* Header */}
      <header className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-neutral-100">TraderLab</h1>
          <div className="text-xs" style={{ color: tokens.muted }}>
            trades: {trades.length} • symbols: {derived.perSymbol.length}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer border text-neutral-200 hover:text-neutral-100"
            style={{ borderColor: tokens.grid }}
          >
            <span className="text-sm">Upload CSV</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e)=>onCsvSelected(e.target.files?.[0])}/>
            {csvPreviewRows
              ? <span className="text-xs" style={{color:tokens.muted}}>preview ready → Import</span>
              : <span className="text-xs" style={{color:tokens.muted}}>preview before import</span>}
          </label>
          {csvPreviewRows && (
            <button onClick={importCsv} className="px-3 py-2 text-sm rounded-xl"
              style={{ background: tokens.primary, color: "white" }}>
              Import to TraderLab
            </button>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Net P&L" value={fmtMoney(derived.totals.net)} accent={tokens.primary}/>
        <SummaryCard label="Fees" value={fmtMoney(derived.totals.fee)} accent={tokens.secondary}/>
        <SummaryCard label="Win Rate" value={`${derived.winRate.toFixed(1)}%`} accent={tokens.accent}/>
        <SummaryCard label="# Trades" value={trades.length} accent={tokens.info}/>
      </div>

      {/* Main two-column: left controls / right charts */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Run settings */}
          <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm" style={{ color: tokens.muted }}>Run Settings</div>
              <div className="flex gap-2">
                <IconButton title={savingRun?"Saving…":"Save run"} onClick={saveRunMeta} style={{borderColor:tokens.grid}}>
                  <SaveIcon color={tokens.primary}/>
                </IconButton>
                <IconButton title={deletingRun?"Deleting…":"Delete run"} onClick={deleteRun} style={{borderColor:tokens.grid}}>
                  <TrashIcon color={tokens.danger}/>
                </IconButton>
              </div>
            </div>
            <Input label="Name" value={runMeta.name} onChange={(v)=>setRunMeta(m=>({...m,name:v}))} tokens={tokens}/>
            <Input label="Initial Capital" type="number" value={runMeta.initial_capital} onChange={(v)=>setRunMeta(m=>({...m,initial_capital:v}))} tokens={tokens}/>
            <div className="mt-2">
              <label className="text-xs" style={{ color: tokens.muted }}>Notes</label>
              <textarea
                className="w-full rounded-xl px-3 py-2 border focus:outline-none"
                style={{
                  borderColor: hexToRgba(tokens.accent, 0.35),
                  background: hexToRgba(tokens.accent, 0.10),
                  color: tokens.accent,
                }}
                rows={3}
                value={runMeta.notes}
                onChange={(e)=>setRunMeta(m=>({...m,notes:e.target.value}))}
              />
            </div>
          </div>

          {/* FX Assist + Presets */}
          <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid, background: hexToRgba(tokens.accent, 0.04) }}>
            <div className="text-sm mb-2" style={{ color: tokens.muted }}>FX P&L Assist</div>
            <div className="flex items-center gap-2 mb-2">
              <input id="fxEnabled" type="checkbox" checked={fxCfg.enabled} onChange={e=>setFxCfg(c=>({...c,enabled:e.target.checked}))}/>
              <label htmlFor="fxEnabled" className="text-sm">Enable pip-based P&L for FX symbols</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="FX Preset"
                value={fxCfg.preset}
                onChange={(v)=>setFxCfg(c=>({...c,preset:v}))}
                options={FX_PRESETS.map(p=>({label:p.label, value:p.code}))}
                tokens={tokens}
              />
              <Input label="Pip $ per lot" value={fxCfg.pipUSD} onChange={(v)=>setFxCfg(c=>({...c,pipUSD:v}))} tokens={tokens}/>
              <Select label="Size Units" value={fxCfg.sizeIsLots ? "lots" : "units"} onChange={(v)=>setFxCfg(c=>({...c,sizeIsLots:v==="lots"}))}
                options={[{label:"Lots (std 100k)", value:"lots"},{label:"Units", value:"units"}]} tokens={tokens}/>
            </div>
            <div className="text-xs mt-2" style={{ color: tokens.muted }}>
              Example: EURUSD 1.16443→1.16500, 1.0 lot, $10/pip ≈ +$5.7 per 0.00057 move (minus fees).
            </div>
          </div>

          {/* Risk config & helpers */}
          <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
            <div className="text-sm mb-2" style={{ color: tokens.muted }}>Risk & R-Multiples</div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Risk $ per trade" value={riskCfg.riskPerTradeUSD} onChange={(v)=>setRiskCfg(c=>({...c,riskPerTradeUSD:v}))} tokens={tokens}/>
              <Input label="Per-point $ (non-FX)" value={riskCfg.perPointUSD} onChange={(v)=>setRiskCfg(c=>({...c,perPointUSD:v}))} tokens={tokens}/>
            </div>
            <div className="text-xs mt-2" style={{ color: tokens.muted }}>
              1R is computed from Entry↔Stop × per-point (or FX pip value) × size. Expectancy & “closed early” are based on realized R.
            </div>
          </div>

          {/* Add Trade */}
          <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
            <div className="font-medium mb-2 text-neutral-100">Add Trade</div>
            <form className="grid md:grid-cols-2 gap-2" onSubmit={addTrade}>
              <Input label="Date" type="date" value={form.date} onChange={(v)=>setForm(f=>({...f,date:v}))} tokens={tokens}/>
              <Input label="Time" type="time" value={form.trade_time} onChange={(v)=>setForm(f=>({...f,trade_time:v}))} tokens={tokens}/>
              <Input label="Symbol" value={form.symbol} onChange={(v)=>setForm(f=>({...f,symbol:v}))} placeholder="AAPL / EURUSD" tokens={tokens}/>
              <Select label="Direction" value={form.direction} onChange={(v)=>setForm(f=>({...f,direction:v}))}
                options={[{label:"Long",value:"long"},{label:"Short",value:"short"}]} tokens={tokens}/>
              <Input label={`Size (${fxCfg.sizeIsLots ? "lots" : "units"})`} value={form.size} onChange={(v)=>setForm(f=>({...f,size:v}))} tokens={tokens}/>
              <Input label="Entry" value={form.entry_price} onChange={(v)=>setForm(f=>({...f,entry_price:v}))} tokens={tokens}/>
              <Input label="Stop" value={form.stop_price} onChange={(v)=>setForm(f=>({...f,stop_price:v}))} tokens={tokens}/>
              <Input label="Target" value={form.target_price} onChange={(v)=>setForm(f=>({...f,target_price:v}))} tokens={tokens}/>

              {/* R pills + size suggest */}
              <div className="md:col-span-2 flex flex-wrap gap-2 items-center">
                <span className="text-xs" style={{ color: tokens.muted }}>Set target:</span>
                {[1,2,3,4].map(r=>(
                  <button key={r} type="button" className="px-2 py-1 rounded-lg text-xs border"
                          onClick={()=>ratioTarget(r)}
                          style={{ borderColor: tokens.grid, background: hexToRgba(tokens.accent,0.08), color: tokens.accent }}>
                    {r}:1
                  </button>
                ))}
                <span className="mx-1 text-xs" style={{ color: tokens.muted }}>•</span>
                <button type="button" className="px-2 py-1 rounded-lg text-xs border text-neutral-200 hover:text-neutral-100"
                        onClick={suggestSizeFromRisk}
                        style={{ borderColor: tokens.grid }}>
                  Suggest size from Risk$
                </button>
              </div>

              <Input label="Fee" value={form.fee} onChange={(v)=>setForm(f=>({...f,fee:v}))} tokens={tokens}/>
              <div>
                <label className="text-xs" style={{ color: tokens.muted }}>Strategy</label>
                <input
                  className="w-full rounded-xl px-3 py-2 border focus:outline-none"
                  list="strategy-presets"
                  style={{
                    borderColor: hexToRgba(tokens.accent, 0.35),
                    background: hexToRgba(tokens.accent, 0.10),
                    color: tokens.accent,
                  }}
                  value={form.strategy}
                  onChange={(e)=>setForm(f=>({...f,strategy:e.target.value}))}
                  placeholder="Breakout / Pullback / Range / News…"
                />
                <datalist id="strategy-presets">
                  {["Breakout","Pullback","Trend Continuation","Range Reversal","News","Scalp","Swing","S/R Bounce","Mean Revert"].map(s=>
                    <option key={s} value={s} />
                  )}
                </datalist>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs" style={{ color: tokens.muted }}>Notes</label>
                <textarea
                  className="w-full rounded-xl px-3 py-2 border focus:outline-none"
                  style={{
                    borderColor: hexToRgba(tokens.accent, 0.35),
                    background: hexToRgba(tokens.accent, 0.10),
                    color: tokens.accent,
                  }}
                  rows={2}
                  value={form.notes}
                  onChange={(e)=>setForm(f=>({...f,notes:e.target.value}))}
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: tokens.muted }}>Attachment (optional)</label>
                <input type="file" accept="image/*,application/pdf" onChange={(e)=>setFormAttachment(e.target.files?.[0]||null)}/>
              </div>
              <div className="flex items-end">
                <button className="px-3 py-2 text-sm rounded-xl" style={{ background: tokens.primary, color: "white" }} type="submit">
                  Add Trade
                </button>
              </div>
            </form>
          </div>

          {/* Journal panel (embedded, compact) */}
          <JournalPanel compact />
        </div>

        {/* RIGHT */}
        <div className="md:col-span-2 space-y-4">
          {/* charts row: small pie + big bar */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
              <div className="text-sm text-neutral-400">Profit Share</div>
              <div className="text-xs mb-1" style={{ color: hexToRgba(tokens.muted, 0.9) }}>
                {derived.pieData.length === 0 ? "No positive P&L yet — equal slices shown." : "Share of P&L (abs)."}
              </div>
              <div className="w-full" style={{ height: 220 }}>
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
            <div className="md:col-span-2 border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
              <div className="text-sm mb-2 text-neutral-400">P&L by Symbol</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={derived.barData}>
                    <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="symbol" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <ReTooltip formatter={(v) => fmtMoney(v)} contentStyle={darkTooltip} />
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

          {/* hours */}
          <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-400">Trading Hours (win%)</div>
              <div className="text-xs" style={{ color: tokens.muted }}>
                Best hour: {derived.bestHour.hour === null ? "—" : `${String(derived.bestHour.hour).padStart(2,"0")}:00–${String((derived.bestHour.hour+1)%24).padStart(2,"0")}:00`}
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

          {/* R bucket table */}
          <RBucketsTable rows={derived.rStats} tokens={tokens} />

          {/* per-strategy table */}
          <PerStrategyTable data={derived.perStrategy} tokens={tokens} />

          {/* CSV preview */}
          {csvPreviewRows && (
            <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-neutral-100">CSV Preview</div>
                <div className="flex gap-2">
                  <button className="text-sm px-3 py-2 rounded-xl" style={{ background: tokens.primary, color:"white" }} onClick={importCsv}>
                    Import to TraderLab
                  </button>
                  <button className="text-sm px-3 py-2 rounded-xl border text-neutral-200 hover:text-neutral-100" style={{ borderColor: tokens.grid }}
                    onClick={()=>{ setCsvPreviewRows(null); setCsvFile(null); }}>
                    Discard Preview
                  </button>
                </div>
              </div>
              <CsvPreviewTable rows={csvPreviewRows} tokens={tokens}/>
            </div>
          )}

          {/* per-symbol table */}
          <PerSymbolTable data={derived.perSymbol} loading={loading} tokens={tokens} />

          {/* trades table */}
          <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
            <div className="font-medium mb-2 text-neutral-100">Trades</div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: tokens.grid }}>
                    <Th tokens={tokens}>Date</Th>
                    <Th tokens={tokens}>Time</Th>
                    <Th tokens={tokens}>Symbol</Th>
                    <Th tokens={tokens}>Side</Th>
                    <Th tokens={tokens}>Size</Th>
                    <Th tokens={tokens}>Entry</Th>
                    <Th tokens={tokens}>Stop</Th>
                    <Th tokens={tokens}>Target</Th>
                    <Th tokens={tokens}>Fee</Th>
                    <Th tokens={tokens}>P&L</Th>
                    <Th tokens={tokens}>Planned R</Th>
                    <Th tokens={tokens}>Realized R</Th>
                    <Th tokens={tokens}>Outcome</Th>
                    <Th tokens={tokens}>Strategy</Th>
                    <Th tokens={tokens}>Chart</Th>
                    <Th tokens={tokens}>Attach</Th>
                    <Th tokens={tokens}></Th>
                  </tr>
                </thead>
                <tbody>
                  {derived.rows.map(r=>{
                    const bg = rowBgs(tokens);
                    return (
                      <tr key={r.id} className="border-b align-top"
                          style={{ borderColor: tokens.grid, background: bg.base, transition: "background-color 120ms ease" }}
                          onMouseEnter={(e)=>e.currentTarget.style.background=bg.hover}
                          onMouseLeave={(e)=>e.currentTarget.style.background=bg.base}>
                        <Td>{r.date ? new Date(`${r.date}T00:00:00`).toLocaleDateString() : "—"}</Td>
                        <Td>{r.trade_time ? r.trade_time.slice(0,5) : "—"}</Td>
                        <Td>{r.symbol}</Td>
                        <Td>
                          <span className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              background: hexToRgba(r.direction==="short"?tokens.danger:tokens.success,0.12),
                              color: r.direction==="short"?tokens.danger:tokens.success,
                              border: `1px solid ${hexToRgba(r.direction==="short"?tokens.danger:tokens.success,0.2)}`
                            }}>
                            {String(r.direction||"").toUpperCase()}
                          </span>
                        </Td>
                        <Td>{r.size ?? "—"}</Td>
                        <Td>{r.entry ?? "—"}</Td>
                        <Td>{r.sl ?? "—"}</Td>
                        <Td>{r.tp ?? "—"}</Td>
                        <Td>{fmtMoney(r.fee)}</Td>
                        <Td style={{ color: r.pnl>=0 ? tokens.success : tokens.danger }}>{fmtMoney(r.pnl)}</Td>
                        <Td>{r.plannedRR!=null ? `${r.plannedRR.toFixed(2)}:1` : "—"}</Td>
                        <Td>{r.realizedR!=null ? `${r.realizedR.toFixed(2)}R` : "—"}</Td>
                        <Td>{r.outcome}</Td>
                        <Td>{r.strategy}</Td>
                        <Td>
                          {r.attachment ? (
                            r.attachment.match(/\.(png|jpg|jpeg|webp|gif)$/i)
                              ? <a href={r.attachment} target="_blank" rel="noreferrer"><img src={r.attachment} alt="" className="h-12 w-12 object-cover rounded-lg" style={{border:`1px solid ${tokens.grid}`}}/></a>
                              : <a className="underline" href={r.attachment} target="_blank" rel="noreferrer">View file</a>
                          ) : <span className="text-xs" style={{color:tokens.muted}}>None</span>}
                          {r.attachment && (
                            <div>
                              <button className="text-xs underline mt-1" onClick={()=>removeAttachment(r.id)}>Remove</button>
                            </div>
                          )}
                        </Td>
                        <Td>
                          <label className="text-xs px-2 py-1 rounded-lg cursor-pointer inline-flex items-center gap-1 border text-neutral-200 hover:text-neutral-100" style={{ borderColor: tokens.grid }}>
                            {imageUploading===r.id?"Uploading…":"Upload"}
                            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e)=>attachFile(r.id,e.target.files?.[0])}/>
                          </label>
                        </Td>
                        <Td>
                          <button
                            className="text-xs px-2 py-1 rounded-lg border"
                            style={{ borderColor: tokens.grid, color: tokens.danger, background: hexToRgba(tokens.danger, 0.06) }}
                            onClick={()=>deleteTrade(r.id)}
                          >
                            Delete
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                  {derived.rows.length===0 && (
                    <tr>
                      <td className="py-4" style={{ color: tokens.muted }} colSpan={17}>
                        {loading ? "Loading…" : "No trades yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ---------------- small UI bits ---------------- */
function SummaryCard({label,value,accent}) {
  return (
    <div className="rounded-2xl p-3"
         style={{ border:`1px solid ${hexToRgba(accent,0.25)}`, background:hexToRgba(accent,0.06) }}>
      <div className="text-xs" style={{ color: hexToRgba(accent,0.9) }}>{label}</div>
      <div className="text-lg font-semibold mt-1 text-neutral-100">{value}</div>
    </div>
  );
}
function Th({ children, tokens }) {
  return <th className="py-2 pr-4 text-xs font-semibold" style={{ color: tokens.muted }}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`py-2 pr-4 ${className}`}>{children}</td>;
}
function Input({ label, value, onChange, type = "text", placeholder, tokens }) {
  return (
    <div>
      <label className="text-xs" style={{ color: tokens.muted }}>{label}</label>
      <input
        className="w-full rounded-xl px-3 py-2 border focus:outline-none"
        style={{
          borderColor: hexToRgba(tokens.accent, 0.35),
          background: hexToRgba(tokens.accent, 0.10),
          color: tokens.accent,
        }}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
function Select({ label, value, onChange, options, tokens }) {
  return (
    <div>
      <label className="text-xs" style={{ color: tokens.muted }}>{label}</label>
      <select
        className="w-full rounded-xl px-3 py-2 border focus:outline-none"
        style={{
          borderColor: hexToRgba(tokens.accent, 0.35),
          background: hexToRgba(tokens.accent, 0.10),
          color: tokens.accent,
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function CsvPreviewTable({ rows, tokens }) {
  if (!rows?.length) return <div className="text-xs" style={{ color: tokens.muted }}>Empty</div>;
  const headers = Object.keys(rows[0] || {});
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b" style={{ borderColor: tokens.grid }}>
            {headers.map(h => <th key={h} className="py-2 pr-4">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, i) => {
            const bg = rowBgs(tokens);
            return (
              <tr key={i} className="border-b"
                  style={{ borderColor: tokens.grid, background: bg.base, transition: "background-color 120ms ease" }}
                  onMouseEnter={(e)=>e.currentTarget.style.background = bg.hover}
                  onMouseLeave={(e)=>e.currentTarget.style.background = bg.base}>
                {headers.map(h => (
                  <td key={h} className="py-2 pr-4 whitespace-nowrap">{String(row[h] ?? "")}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length>200 && <div className="text-xs mt-2" style={{ color: tokens.muted }}>Showing first 200 rows…</div>}
    </div>
  );
}
function PerSymbolTable({ data, loading, tokens }) {
  return (
    <div className="rounded-2xl p-3" style={{ border: `1px solid ${tokens.grid}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-neutral-100">Per-Symbol Breakdown</div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: tokens.grid }}>
              <Th tokens={tokens}>Symbol</Th>
              <Th tokens={tokens}># Trades</Th>
              <Th tokens={tokens}>Wins</Th>
              <Th tokens={tokens}>Losses</Th>
              <Th tokens={tokens}>Win %</Th>
              <Th tokens={tokens}>Net P&L</Th>
              <Th tokens={tokens}>Avg P&L</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const bg = rowBgs(tokens);
              return (
                <tr key={r.symbol} className="border-b"
                    style={{ borderColor: tokens.grid, background: bg.base, transition: "background-color 120ms ease" }}
                    onMouseEnter={(e)=>e.currentTarget.style.background=bg.hover}
                    onMouseLeave={(e)=>e.currentTarget.style.background=bg.base}>
                  <Td>{r.symbol}</Td>
                  <Td>{r.trades}</Td>
                  <Td>{r.wins}</Td>
                  <Td>{r.losses}</Td>
                  <Td>{r.winRate.toFixed(1)}%</Td>
                  <Td style={{ color: r.netPnL >= 0 ? tokens.success : tokens.danger }}>{fmtMoney(r.netPnL)}</Td>
                  <Td>{fmtMoney(r.avgPnL)}</Td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td className="py-4" style={{ color: tokens.muted }} colSpan={7}>
                  {loading ? "Loading…" : "No data yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function PerStrategyTable({ data, tokens }) {
  return (
    <div className="rounded-2xl p-3" style={{ border: `1px solid ${tokens.grid}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-neutral-100">Per-Strategy Breakdown</div>
        <div className="text-xs" style={{ color: tokens.muted }}>Win% and Avg R by strategy</div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: tokens.grid }}>
              <Th tokens={tokens}>Strategy</Th>
              <Th tokens={tokens}>Trades</Th>
              <Th tokens={tokens}>Wins</Th>
              <Th tokens={tokens}>Win %</Th>
              <Th tokens={tokens}>Avg R</Th>
              <Th tokens={tokens}>Net P&L</Th>
            </tr>
          </thead>
          <tbody>
            {(data||[]).map((r,i)=>{
              const bg = rowBgs(tokens);
              return (
                <tr key={i} className="border-b"
                    style={{ borderColor: tokens.grid, background: bg.base }}
                    onMouseEnter={(e)=>e.currentTarget.style.background = hexToRgba(tokens.accent, 0.12)}
                    onMouseLeave={(e)=>e.currentTarget.style.background = bg.base}>
                  <Td>{r.strategy}</Td>
                  <Td>{r.trades}</Td>
                  <Td>{r.wins}</Td>
                  <Td>{r.winRate.toFixed(1)}%</Td>
                  <Td>{Number(r.avgR).toFixed(2)}R</Td>
                  <Td style={{ color: r.netPnL >= 0 ? tokens.success : tokens.danger }}>{fmtMoney(r.netPnL)}</Td>
                </tr>
              );
            })}
            {(!data || data.length===0) && (
              <tr>
                <td className="py-4" style={{ color: tokens.muted }} colSpan={6}>No strategy data yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function RBucketsTable({ rows, tokens }) {
  return (
    <div className="rounded-2xl p-3" style={{ border: `1px solid ${tokens.grid}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-neutral-100">Win% by Planned R:R</div>
        <div className="text-xs" style={{ color: tokens.muted }}>Counts based on planned R bucket (1,2,3,4)</div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: tokens.grid }}>
              <Th tokens={tokens}>Planned R</Th>
              <Th tokens={tokens}>Trades</Th>
              <Th tokens={tokens}>Wins</Th>
              <Th tokens={tokens}>Win %</Th>
              <Th tokens={tokens}>Avg Realized R</Th>
              <Th tokens={tokens}>Achieved ≥ R</Th>
            </tr>
          </thead>
          <tbody>
            {(rows||[]).map(r=>{
              const bg = rowBgs(tokens);
              return (
                <tr key={r.bucket} className="border-b"
                    style={{ borderColor: tokens.grid, background: bg.base }}
                    onMouseEnter={(e)=>e.currentTarget.style.background = hexToRgba(tokens.accent, 0.12)}
                    onMouseLeave={(e)=>e.currentTarget.style.background = bg.base}>
                  <Td>{r.bucket}:1</Td>
                  <Td>{r.trades}</Td>
                  <Td>{r.wins}</Td>
                  <Td>{r.winRate.toFixed(1)}%</Td>
                  <Td>{r.avgRealizedR.toFixed(2)}R</Td>
                  <Td>{r.achievedGE}</Td>
                </tr>
              );
            })}
            {(!rows || rows.length===0) && (
              <tr><td className="py-4" style={{ color: tokens.muted }} colSpan={6}>No R bucket data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
