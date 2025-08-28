// src/pages/Backtesting.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { api } from "../api/axios";

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
    accent: "#06b6d4",   // teal
    success: "#10b981",
    danger: "#ef4444",
    warning: "#f59e0b",
    info: "#0ea5e9",
    muted: "#94a3b8",
    grid: "#e5e7eb",
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

/* ---- FX assist helpers (optional) ---- */
function parseFx(symRaw) {
  if (!symRaw) return null;
  const s = String(symRaw).toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z]{6}$/.test(s)) return { base: s.slice(0,3), quote: s.slice(3) };
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(s)) return { base: s.slice(0,3), quote: s.slice(4,7) };
  return null;
}
function pipSizeFor(quote) { return quote === "JPY" ? 0.01 : 0.0001; }

/* ---- Notes parsing (SL/TP/HIGH/LOW/MFE/MAE/STRAT) ---- */
function parseMetaFromNotes(notes) {
  const out = { sl: null, tp: null, high: null, low: null, mfe: null, mae: null, strategy: null };
  if (!notes) return out;
  const text = String(notes);

  const num = (m) => (m ? toNum(m[1]) : null);

  out.sl   = num(text.match(/(?:^|\b)SL:\s*([0-9.]+)/i));
  out.tp   = num(text.match(/(?:^|\b)TP:\s*([0-9.]+)/i));
  out.high = num(text.match(/(?:^|\b)HIGH:\s*([0-9.]+)/i));
  out.low  = num(text.match(/(?:^|\b)LOW:\s*([0-9.]+)/i));
  out.mfe  = num(text.match(/(?:^|\b)MFE:\s*([0-9.]+)/i));
  out.mae  = num(text.match(/(?:^|\b)MAE:\s*([0-9.]+)/i));

  const mStrat = text.match(/STRAT(?:EGY)?:\s*([^|]+?)(?:\s*\||$)/i);
  if (mStrat) out.strategy = mStrat[1].trim();
  return out;
}
function stripAndUpsertTokens(notes, updates) {
  let s = String(notes || "");
  const keys = Object.keys(updates);
  keys.forEach((k) => {
    const re = new RegExp(`(?:^|\\s*\\|\\s*)${k}:\\s*[^|]+`, "gi");
    s = s.replace(re, "");
  });
  const add = keys
    .filter((k) => updates[k] !== null && updates[k] !== "" && updates[k] !== undefined)
    .map((k) => `${k}: ${updates[k]}`);
  const joined = [s.trim().replace(/\s*\|\s*$/,""), ...add].filter(Boolean).join(" | ");
  return joined.replace(/\s*\|\s*\|\s*/g, " | ").trim();
}

/* ====== ADDED: R token parsing + time helpers ====== */
function hmsToSeconds(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2}):([0-5]\d):([0-5]\d)$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]), s = Number(m[3]);
  return (h * 3600) + (mi * 60) + s;
}
function secondsToHMS(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function formatCompactDuration(seconds) {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}
function parseRFromNotes(notes) {
  const t = String(notes || "");
  const levels = [1,2,3,4].map(() => ({ state: null, time: null }));
  [1,2,3,4].forEach((i) => {
    const mHit = t.match(new RegExp(`(?:^|\\b)R${i}:\\s*([YN])`, "i"));
    const mTim = t.match(new RegExp(`(?:^|\\b)R${i}T:\\s*([0-9]{1,2}:[0-9]{2}:[0-9]{2})`, "i"));
    levels[i-1] = {
      state: mHit ? mHit[1].toUpperCase() : null,
      time: mTim ? mTim[1] : null,
    };
  });
  const mDur = t.match(/(?:^|\b)DUR:\s*([0-9]{1,2}:[0-9]{2}:[0-9]{2})/i);
  const dur = mDur ? mDur[1] : null;
  return { levels, dur }; // levels[i] = {state:'Y'|'N'|null, time:'hh:mm:ss'|null}
}

/* ---------------- page ---------------- */
export default function Backtesting() {
  const tokens = useColorTokens();

  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);

  // run meta (editable)
  const [runMeta, setRunMeta] = useState({ name: "", initial_capital: "", notes: "" });
  const [savingRun, setSavingRun] = useState(false);
  const [deletingRun, setDeletingRun] = useState(false);

  // CSV preview (when no run is selected)
  const [csvPreviewRows, setCsvPreviewRows] = useState(null);
  const [lastCsvFile, setLastCsvFile] = useState(null);

  // attachments
  const [imageUploading, setImageUploading] = useState(null);
  const fileInputRef = useRef(null);

  // manual create form
  const [form, setForm] = useState({
    date: "", trade_time: "", symbol: "", direction: "long", size: "",
    entry_price: "", exit_price: "", fee: "", notes: "",
    // NEW: extremes (stored in notes)
    high: "", low: "", mfe: "", mae: "",
    // NEW: RR calc (also stored in notes)
    sl: "", tp: "",
  });

  // FX assist (UI-level, optional)
  const [fxCfg, setFxCfg] = useState({
    enabled: false,
    pipUSD: "10",
    sizeIsLots: true,
  });

  // RR hit analysis mode (existing)
  const [hitMode, setHitMode] = useState("hl"); // 'hl' | 'mfe' | 'exit'

  // ADDED: Expanded map for R edit sub-rows
  const [expanded, setExpanded] = useState({});

  useEffect(() => { loadRuns(); }, []);

  async function loadRuns() {
    try {
      const { data } = await api.get("/api/journal/backtests/runs/");
      setRuns(data || []);
      let newSelected = selectedRunId;
      if (!newSelected && (data || []).length) newSelected = String(data[0].id);
      setSelectedRunId(newSelected || "");
      syncRunMetaFromRuns(data, newSelected);
      if (newSelected) loadTrades(newSelected);
    } catch (e) {
      console.error("Failed to load runs", e);
    }
  }
  function syncRunMetaFromRuns(allRuns, runId) {
    if (!runId) { setRunMeta({ name: "", initial_capital: "", notes: "" }); return; }
    const r = (allRuns || []).find(x => String(x.id) === String(runId));
    if (!r) return;
    setRunMeta({
      name: r.name || "",
      initial_capital: (r.initial_capital ?? "") === "" ? "" : String(r.initial_capital),
      notes: r.notes || "",
    });
  }
  useEffect(() => {
    if (!selectedRunId) { setTrades([]); setRunMeta({ name: "", initial_capital: "", notes: "" }); return; }
    loadTrades(selectedRunId);
    syncRunMetaFromRuns(runs, selectedRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId]);

  async function loadTrades(runId) {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/journal/backtests/trades/?run=${encodeURIComponent(runId)}`);
      setTrades(data || []);
    } catch (e) {
      console.error("Failed to load trades", e);
      setTrades([]);
    } finally { setLoading(false); }
  }

  // P&L (with optional FX assist)
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

  // --- R:R helpers (existing "possible hits" based on notes extremes or exit)
  function riskPts(t, meta) {
    const entry = toNum(t.entry_price);
    const sl = meta.sl;
    if (entry == null || sl == null) return null;
    const r = Math.abs(entry - sl);
    return Number.isFinite(r) && r > 0 ? r : null;
  }
  function favorablePts(t, meta) {
    const entry = toNum(t.entry_price);
    if (entry == null) return null;

    if (hitMode === "hl") {
      if (meta.high != null || meta.low != null) {
        if (t.direction === "long" && meta.high != null) return Math.max(0, meta.high - entry);
        if (t.direction === "short" && meta.low != null)  return Math.max(0, entry - meta.low);
      }
    }
    if (hitMode === "mfe") {
      if (meta.mfe != null) return Math.max(0, meta.mfe);
    }
    const exit = toNum(t.exit_price);
    if (exit == null) return null;
    return t.direction === "long"
      ? Math.max(0, exit - entry)
      : Math.max(0, entry - exit);
  }
  function adversePts(t, meta) {
    const entry = toNum(t.entry_price);
    if (entry == null) return null;

    if (hitMode === "hl") {
      if (meta.low != null || meta.high != null) {
        if (t.direction === "long" && meta.low  != null) return Math.max(0, entry - meta.low);
        if (t.direction === "short" && meta.high != null) return Math.max(0, meta.high - entry);
      }
    }
    if (hitMode === "mfe") {
      if (meta.mae != null) return Math.max(0, meta.mae);
    }
    const exit = toNum(t.exit_price);
    if (exit == null) return null;
    return t.direction === "long"
      ? Math.max(0, entry - exit)
      : Math.max(0, exit - entry);
  }
  function rrHits(t, meta) {
    const rpts = riskPts(t, meta);
    if (rpts == null) return { r: null, states: [null,null,null,null] };
    const fav = favorablePts(t, meta) ?? 0;
    const adv = adversePts(t, meta) ?? 0;
    const states = [1,2,3,4].map((k) => {
      const need = k * rpts;
      const hit = fav >= need;
      const stopped = adv >= rpts;
      if (hit && stopped) return "?";     // ambiguous ordering
      return hit ? "Y" : "N";
    });
    return { r: rpts, states };
  }

  // ====== DERIVED ======
  const derived = useMemo(() => {
    const rows = (trades || []).map((t) => {
      const pnl = computePnL(t);
      const meta = parseMetaFromNotes(t.notes);
      const rr = rrHits(t, meta);
      const rRec = parseRFromNotes(t.notes);

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
        meta,
        rr,   // possible hits (computed)
        rRec, // recorded hits/times in notes
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

    // Pie data (abs P&L)
    let pieData = perSymbol.map((s) => ({ name: s.symbol, value: Math.abs(s.netPnL) }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0);
    if (pieData.length === 0 && perSymbol.length > 0) {
      pieData = perSymbol.map((s) => ({ name: s.symbol, value: Math.max(1, s.trades) }));
    }
    const barData = perSymbol.map((s) => ({ symbol: s.symbol, pnl: Number((s.netPnL ?? 0).toFixed(2)) }))
      .filter((d) => Number.isFinite(d.pnl));

    // Hour-of-day buckets
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

    // RR "possible hits" totals
    const rrTotals = [0,0,0,0];  // definite Y
    const rrAmbig  = [0,0,0,0];  // '?'
    rows.forEach(r => {
      (r.rr?.states || []).forEach((s, i) => {
        if (s === "Y") rrTotals[i] += 1;
        if (s === "?") rrAmbig[i] += 1;
      });
    });

    // ====== Recorded R metrics extracted from notes (R1..R4 / R1T..R4T) ======
    const rec = [0,0,0,0];      // how many trades recorded (Y or N) for kR
    const recWins = [0,0,0,0];  // how many Y among recorded
    const recTimes = [[],[],[],[]]; // seconds list for avg where hit=Y and time present
    let durCount = 0;
    let durSum = 0;
    rows.forEach(r => {
      (r.rRec?.levels || []).forEach((lv, i) => {
        if (lv?.state === "Y" || lv?.state === "N") {
          rec[i] += 1;
          if (lv.state === "Y") {
            recWins[i] += 1;
            const secs = hmsToSeconds(lv.time);
            if (secs != null) recTimes[i].push(secs);
          }
        }
      });
      const dSecs = hmsToSeconds(r.rRec?.dur);
      if (dSecs != null) { durCount += 1; durSum += dSecs; }
    });
    const recWinRates = rec.map((n, i) => (n ? (recWins[i] / n) * 100 : 0));
    const recAvgTimes = recTimes.map((arr) => {
      if (!arr.length) return null;
      const sum = arr.reduce((s, v) => s + v, 0);
      return Math.round(sum / arr.length);
    });
    const avgDurSeconds = durCount ? Math.round(durSum / durCount) : null;

    return {
      rows, perSymbol, totals, winRate,
      pieData, barData, hourData, bestHour,
      rrTotals, rrAmbig,
      rec, recWins, recWinRates, recAvgTimes, avgDurSeconds,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, fxCfg, hitMode]);

  /* ------------- actions: run meta ------------- */
  async function saveRunMeta() {
    if (!selectedRunId) return;
    setSavingRun(true);
    try {
      const payload = {
        name: runMeta.name || "Untitled Backtest",
        initial_capital: runMeta.initial_capital === "" ? 0 : Number(runMeta.initial_capital),
        notes: runMeta.notes || "",
      };
      await api.patch(`/api/journal/backtests/runs/${selectedRunId}/`, payload);
      await loadRuns();
    } catch (e) {
      console.error(e);
      alert("Failed to save run.");
    } finally {
      setSavingRun(false);
    }
  }
  async function deleteRun() {
    if (!selectedRunId) return;
    const r = runs.find(x => String(x.id) === String(selectedRunId));
    const name = r?.name || `Run ${selectedRunId}`;
    if (!window.confirm(`Delete "${name}" and ALL its trades? This cannot be undone.`)) return;

    setDeletingRun(true);
    try {
      await api.delete(`/api/journal/backtests/runs/${selectedRunId}/`);
      const remaining = runs.filter(x => String(x.id) !== String(selectedRunId));
      setRuns(remaining);
      const next = remaining[0]?.id ? String(remaining[0].id) : "";
      setSelectedRunId(next);
      setTrades([]);
      setRunMeta({ name: "", initial_capital: "", notes: "" });
    } catch (e) {
      console.error(e);
      alert("Failed to delete run.");
    } finally {
      setDeletingRun(false);
    }
  }

  /* ------------- actions: trades, csv, attachments ------------- */
  function onCsvSelected(file) {
    if (!file) return;
    if (!selectedRunId) {
      setLastCsvFile(file);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => setCsvPreviewRows(res.data || []),
        error: (err) => console.error("CSV parse error", err),
      });
      return;
    }
    importCsvIntoRun(file, selectedRunId);
  }
  async function importCsvIntoRun(file, runId) {
    const form = new FormData();
    form.append("file", file);
    form.append("run_id", runId);
    try {
      await api.post("/api/journal/backtests/import_csv/", form, { headers: { "Content-Type": "multipart/form-data" } });
      await loadTrades(runId);
      setCsvPreviewRows(null);
      setLastCsvFile(null);
    } catch (e) {
      console.error(e);
      alert("Import failed. Check CSV format.");
    }
  }
  async function createRunFromPreviewCsv() {
    if (!lastCsvFile) { alert("No CSV preview loaded."); return; }
    const name = prompt("Name for this new run (will import the CSV into it):", lastCsvFile.name.replace(/\.[^/.]+$/, ""));
    if (!name) return;
    try {
      const { data: run } = await api.post("/api/journal/backtests/runs/", { name });
      await importCsvIntoRun(lastCsvFile, run.id);
      await loadRuns();
      setSelectedRunId(String(run.id));
      setCsvPreviewRows(null);
      setLastCsvFile(null);
    } catch (e) {
      console.error(e);
      alert("Could not create run from CSV.");
    }
  }

  async function addManualTrade(e) {
    e.preventDefault();
    if (!selectedRunId) { alert("Create/select a run first."); return; }
    try {
      // stash optional extremes + SL/TP in notes
      const extra = stripAndUpsertTokens("", {
        ...(form.high ? { HIGH: form.high } : {}),
        ...(form.low  ? { LOW:  form.low }  : {}),
        ...(form.mfe  ? { MFE:  form.mfe }  : {}),
        ...(form.mae  ? { MAE:  form.mae }  : {}),
        ...(form.sl   ? { SL:   form.sl }   : {}),
        ...(form.tp   ? { TP:   form.tp }   : {}),
      });
      const combinedNotes = [extra, form.notes].filter(Boolean).join(" | ");

      const payload = {
        run: Number(selectedRunId),
        date: form.date || new Date().toISOString().slice(0, 10),
        trade_time: form.trade_time || null,
        symbol: (form.symbol || "").toUpperCase(),
        direction: form.direction,
        size: form.size || null,
        entry_price: form.entry_price || null,
        exit_price: form.exit_price || null,
        fee: form.fee || 0,
        notes: combinedNotes,
      };
      await api.post("/api/journal/backtests/trades/", payload);
      await loadTrades(selectedRunId);
      setForm({
        date:"", trade_time:"", symbol:"", direction:"long", size:"",
        entry_price:"", exit_price:"", fee:"", notes:"",
        high:"", low:"", mfe:"", mae:"",
        sl:"", tp:"",
      });
    } catch (e) {
      console.error(e);
      alert("Failed to add trade.");
    }
  }
  async function deleteTrade(tradeId) {
    if (!window.confirm("Delete this trade?")) return;
    try {
      await api.delete(`/api/journal/backtests/trades/${tradeId}/`);
      await loadTrades(selectedRunId);
    } catch (e) {
      console.error(e);
      alert("Failed to delete trade.");
    }
  }
  async function attachFile(tradeId, file) {
    if (!file || !tradeId) return;
    setImageUploading(tradeId);
    try {
      const fd = new FormData();
      fd.append("attachment", file);
      await api.patch(`/api/journal/backtests/trades/${tradeId}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadTrades(selectedRunId);
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
      await loadTrades(selectedRunId);
    } catch (e) {
      console.error(e);
      alert("Failed to remove attachment.");
    }
  }

  // NEW: quick set High/Low into notes for a trade
  async function setHighLowForTrade(trade) {
    const meta = parseMetaFromNotes(trade.notes);
    const high = prompt("Trade HIGH (price reached during trade):", meta.high ?? "");
    if (high === null) return;
    const low  = prompt("Trade LOW (price reached during trade):", meta.low ?? "");
    if (low === null) return;
    const newNotes = stripAndUpsertTokens(trade.notes, { HIGH: high, LOW: low });
    try {
      await api.patch(`/api/journal/backtests/trades/${trade.id}/`, { notes: newNotes });
      await loadTrades(selectedRunId);
    } catch (e) {
      console.error(e);
      alert("Failed to update High/Low.");
    }
  }

  // Update R tokens in notes (R1..R4 / R1T..R4T)
  async function updateRTokens(trade, updates) {
    try {
      const newNotes = stripAndUpsertTokens(trade.notes, updates);
      await api.patch(`/api/journal/backtests/trades/${trade.id}/`, { notes: newNotes });
      await loadTrades(selectedRunId);
    } catch (e) {
      console.error(e);
      alert("Failed to update R tokens.");
    }
  }

  /* ------------- UI ------------- */
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Backtesting</h1>
          <div className="text-xs" style={{ color: tokens.muted }}>
            trades: {trades.length} • symbols: {derived.perSymbol.length}
            {derived.avgDurSeconds != null && (
              <span> • avg time in trade (recorded): {formatCompactDuration(derived.avgDurSeconds)}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              const name = prompt("Name this backtest run:");
              if (!name) return;
              try {
                await api.post("/api/journal/backtests/runs/", { name });
                await loadRuns();
              } catch (e) {
                alert("Failed to create run.");
                console.error(e);
              }
            }}
            className="px-3 py-2 text-sm rounded-xl border"
            style={{ background: tokens.primary, color: "white", borderColor: hexToRgba(tokens.primary, 0.2) }}
          >
            New Run
          </button>

          <label
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer border"
            style={{ borderColor: tokens.grid }}
          >
            <span className="text-sm">Upload CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onCsvSelected(e.target.files?.[0])}
            />
            <span className="text-xs" style={{ color: tokens.muted }}>
              {selectedRunId ? "→ into selected run" : "→ preview (no run selected)"}
            </span>
          </label>
        </div>
      </header>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Net P&L" value={fmtMoney(derived.totals.net)} accent={tokens.primary} />
        <SummaryCard label="Fees" value={fmtMoney(derived.totals.fee)} accent={tokens.secondary} />
        <SummaryCard label="Win Rate" value={`${derived.winRate.toFixed(1)}%`} accent={tokens.accent} />
        <SummaryCard label="# Trades" value={trades.length} accent={tokens.info} />
      </div>

      {/* Recorded R Outcomes (from notes) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map((k, i) => (
          <div key={k} className="rounded-2xl p-3"
               style={{ border: `1px solid ${tokens.grid}`, background: hexToRgba(tokens.accent, 0.06) }}>
            <div className="text-xs" style={{ color: tokens.muted }}>{k}R (Recorded)</div>
            <div className="text-lg font-semibold">{derived.recWinRates[i].toFixed(1)}%</div>
            <div className="text-[11px]" style={{ color: tokens.muted }}>
              {derived.rec[i]} recorded
              {" • "}Avg time: {derived.recAvgTimes[i] != null ? formatCompactDuration(derived.recAvgTimes[i]) : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* LEFT: forms & settings */}
        <div className="space-y-4 md:col-span-1">
          {/* Run selector + controls */}
          <div className="rounded-2xl p-3" style={{ border: `1px solid ${tokens.grid}`, background: hexToRgba(tokens.accent, 0.04) }}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm" style={{ color: tokens.muted }}>Backtest Run</label>
              <div className="flex gap-2">
                <IconButton title={savingRun ? "Saving…" : "Save run"} onClick={saveRunMeta} style={{ borderColor: tokens.grid }}>
                  <SaveIcon color={tokens.primary}/>
                </IconButton>
                <IconButton title={deletingRun ? "Deleting…" : "Delete run"} onClick={deleteRun} style={{ borderColor: tokens.grid }}>
                  <TrashIcon color={tokens.danger}/>
                </IconButton>
              </div>
            </div>
            <select
              className="w-full rounded-xl px-3 py-2 border focus:outline-none"
              style={{ borderColor: tokens.grid, background: hexToRgba(tokens.accent, 0.06), color: tokens.accent }}
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
            >
              {(runs || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || `Run ${r.id}`} {r.started_at ? `— ${new Date(r.started_at).toLocaleString()}` : ""}
                </option>
              ))}
              {(!runs || runs.length === 0) && <option value="">No runs yet</option>}
            </select>

            {/* Meta editor */}
            <div className="mt-3 space-y-2">
              <Input label="Name" value={runMeta.name} onChange={(v) => setRunMeta(m => ({ ...m, name: v }))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
              <Input label="Initial Capital" type="number" value={runMeta.initial_capital} onChange={(v) => setRunMeta(m => ({ ...m, initial_capital: v }))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
              <div>
                <label className="text-xs" style={{ color: tokens.muted }}>Notes</label>
                <textarea
                  className="w-full rounded-xl px-3 py-2 border"
                  style={{ borderColor: tokens.grid, background: hexToRgba(tokens.accent, 0.06), color: tokens.accent }}
                  rows={3}
                  value={runMeta.notes}
                  onChange={(e) => setRunMeta(m => ({ ...m, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* FX Assist */}
          <div className="rounded-2xl p-3" style={{ border: `1px solid ${tokens.grid}` }}>
            <div className="text-sm mb-2" style={{ color: tokens.muted }}>FX Assist (optional)</div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <label className="inline-flex items-center gap-2 text-sm" style={{ color: tokens.muted }}>
                <input type="checkbox" checked={fxCfg.enabled} onChange={(e) => setFxCfg(c => ({ ...c, enabled: e.target.checked }))}/>
                Enable pip-based P&L
              </label>
              <div />
              <Input label="Pip value (USD) per lot" value={fxCfg.pipUSD} onChange={(v) => setFxCfg(c => ({ ...c, pipUSD: v }))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
              <Select
                label="Size mode"
                value={fxCfg.sizeIsLots ? "lots" : "units"}
                onChange={(v) => setFxCfg(c => ({ ...c, sizeIsLots: v === "lots" }))}
                options={[{ label:"Lots (std 100k)", value:"lots" }, { label:"Units", value:"units" }]}
                muted={tokens.muted}
                grid={tokens.grid}
                accent={tokens.accent}
              />
            </div>
          </div>

          {/* R:R Hit Analysis mode (existing) */}
          <div className="rounded-2xl p-3" style={{ border: `1px solid ${tokens.grid}`, background: hexToRgba(tokens.accent, 0.04) }}>
            <div className="text-sm mb-2" style={{ color: tokens.muted }}>R:R Hit Analysis</div>
            <Select
              label="How to judge hits"
              value={hitMode}
              onChange={setHitMode}
              options={[
                { label: "Use High/Low (preferred)", value: "hl" },
                { label: "Use MFE/MAE", value: "mfe" },
                { label: "Exit-only (conservative)", value: "exit" },
              ]}
              muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}
            />
            <div className="text-[11px] mt-2" style={{ color: tokens.muted }}>
              High/Low or MFE/MAE can be recorded in the trade’s notes (we add them for you). If both favorable and adverse
              thresholds are possible without sequence info, the result is “?” (ambiguous).
            </div>
          </div>

          {/* Quick Add Trade (with extremes + SL/TP + RR calculator) */}
          <div className="rounded-2xl p-3" style={{ border: `1px solid ${tokens.grid}` }}>
            <div className="font-medium mb-2">Add Trade</div>

            {/* 2 columns for inputs, 1 column for RR panel on large screens */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Inputs (span 2) */}
              <form className="lg:col-span-2 grid grid-cols-2 gap-2" onSubmit={addManualTrade}>
                <Input label="Date" type="date" value={form.date} onChange={(v) => setForm(f => ({ ...f, date: v }))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Input label="Time" type="time" value={form.trade_time} onChange={(v) => setForm(f => ({ ...f, trade_time: v }))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Input label="Symbol" value={form.symbol} onChange={(v) => setForm(f => ({ ...f, symbol: v }))} placeholder="AAPL / EURUSD" muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Select
                  label="Direction"
                  value={form.direction}
                  onChange={(v) => setForm(f => ({ ...f, direction: v }))}
                  options={[{ label: "Long", value: "long" }, { label: "Short", value: "short" }]}
                  muted={tokens.muted}
                  grid={tokens.grid}
                  accent={tokens.accent}
                />
                <Input label="Size" value={form.size} onChange={(v) => setForm(f => ({ ...f, size: v }))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Input label="Entry" value={form.entry_price} onChange={(v) => setForm(f => ({ ...f, entry_price: v }))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Input label="Exit (optional)" value={form.exit_price} onChange={(v) => setForm(f => ({ ...f, exit_price: v }))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Input label="Fee" value={form.fee} onChange={(v) => setForm(f => ({ ...f, fee: v }))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>

                {/* Extremes for possible-hit logic */}
                <Input label="High (opt)" value={form.high} onChange={(v)=>setForm(f=>({...f,high:v}))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Input label="Low (opt)" value={form.low} onChange={(v)=>setForm(f=>({...f,low:v}))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Input label="MFE pts (opt)" value={form.mfe} onChange={(v)=>setForm(f=>({...f,mfe:v}))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Input label="MAE pts (opt)" value={form.mae} onChange={(v)=>setForm(f=>({...f,mae:v}))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>

                {/* SL/TP for RR calc; also stamped into notes */}
                <Input label="Stop (SL, opt)" value={form.sl} onChange={(v)=>setForm(f=>({...f,sl:v}))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>
                <Input label="Take Profit (TP, opt)" value={form.tp} onChange={(v)=>setForm(f=>({...f,tp:v}))} muted={tokens.muted} grid={tokens.grid} accent={tokens.accent}/>

                <div className="col-span-2">
                  <label className="text-xs" style={{ color: tokens.muted }}>Notes</label>
                  <textarea
                    className="w-full rounded-xl px-3 py-2 border"
                    style={{ borderColor: tokens.grid, background: hexToRgba(tokens.accent, 0.06), color: tokens.accent }}
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <button className="px-3 py-2 text-sm rounded-xl" style={{ background: tokens.primary, color: "white" }} type="submit">
                    Add Trade
                  </button>
                </div>
              </form>

              {/* RR panel (right side) */}
              <RRPanel form={form} setForm={setForm} tokens={tokens} />
            </div>
          </div>

          {/* CSV preview (when no run selected) */}
          {csvPreviewRows && (
            <div className="rounded-2xl p-3" style={{ border: `1px solid ${tokens.grid}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">CSV Preview (not yet saved)</div>
                <div className="flex gap-2">
                  <button className="text-sm px-3 py-2 rounded-xl" style={{ background: tokens.primary, color: "white" }} onClick={createRunFromPreviewCsv}>
                    Create Run from CSV
                  </button>
                  <button className="text-sm px-3 py-2 rounded-xl border" style={{ borderColor: tokens.grid }} onClick={() => { setCsvPreviewRows(null); setLastCsvFile(null); }}>
                    Discard Preview
                  </button>
                </div>
              </div>
              <CsvPreviewTable rows={csvPreviewRows} muted={tokens.muted} grid={tokens.grid} />
            </div>
          )}
        </div>

        {/* RIGHT: Charts + RR summary */}
        <div className="space-y-4 md:col-span-2">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
              <div className="text-sm" style={{ color: tokens.muted }}>Profit Share</div>
              <div className="text-xs mb-1" style={{ color: hexToRgba(tokens.muted, 0.9) }}>
                {derived.pieData.length === 0 ? "No positive P&L yet — showing equal slices by activity." : "Share of P&L (abs values)."}
              </div>
              <div className="w-full" style={{ height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={derived.pieData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={48} paddingAngle={2}>
                      {derived.pieData.map((_, i) => (
                        <Cell key={i} stroke="white" strokeWidth={1} fill={tokens.charts[i % tokens.charts.length]} />
                      ))}
                    </Pie>
                    <ReTooltip contentStyle={{ borderRadius: 12, borderColor: tokens.grid, background: "white" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="md:col-span-2 border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
              <div className="text-sm mb-2" style={{ color: tokens.muted }}>P&L by Symbol</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={derived.barData}>
                    <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="symbol" />
                    <YAxis />
                    <ReTooltip formatter={(v) => fmtMoney(v)} contentStyle={{ borderRadius: 12, borderColor: tokens.grid, background: "white" }} />
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

          {/* Hours chart */}
          <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
            <div className="flex items-center justify-between">
              <div className="text-sm" style={{ color: tokens.muted }}>Trading Hours (win%)</div>
              <div className="text-xs" style={{ color: tokens.muted }}>
                Best hour: {derived.bestHour.hour === null ? "—" : `${String(derived.bestHour.hour).padStart(2, "0")}:00–${String((derived.bestHour.hour + 1) % 24).padStart(2, "0")}:00`}
                {derived.bestHour.hour !== null && ` • ${derived.bestHour.winRate.toFixed(0)}% on ${derived.bestHour.total} trades`}
              </div>
            </div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={derived.hourData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(h) => String(h).padStart(2, "0")} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <ReTooltip formatter={(v, n, p) => [`${v.toFixed?.(0) ?? v}%`, `${String(p?.payload?.hour).padStart(2, "0")}:00`]} />
                  <Bar dataKey="winRate">
                    {(derived.hourData || []).map((d, i) => {
                      const rate = d.winRate || 0;
                      let color = tokens.danger; // <40 red
                      if (rate >= 80) color = tokens.success; else if (rate >= 60) color = "#facc15"; else if (rate >= 40) color = "#f97316";
                      return <Cell key={i} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RR possible hits summary (existing) */}
          <div className="rounded-2xl p-3" style={{ border: `1px solid ${tokens.grid}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Possible R:R Hits ({hitMode.toUpperCase()})</div>
              <div className="text-xs" style={{ color: tokens.muted }}>✓ definite • ? ambiguous</div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[1,2,3,4].map((k, i) => (
                <div key={k} className="rounded-xl p-3"
                  style={{ border:`1px solid ${tokens.grid}`, background: hexToRgba(tokens.accent, 0.06) }}>
                  <div className="text-xs" style={{ color: tokens.muted }}>{k}:1 Hit</div>
                  <div className="text-lg font-semibold">
                    {derived.rrTotals[i]} ✓
                    {derived.rrAmbig[i] ? <span className="text-xs ml-2" style={{ color: "#f59e0b" }}>+ {derived.rrAmbig[i]} ?</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Symbol Table */}
      <PerSymbolTable
        data={derived.perSymbol}
        loading={loading}
        muted={tokens.muted}
        grid={tokens.grid}
        success={tokens.success}
        danger={tokens.danger}
        accent={tokens.accent}
      />

      {/* Trades table */}
      <div className="border rounded-2xl p-3" style={{ borderColor: tokens.grid }}>
        <div className="font-medium mb-2">Trades (Run {selectedRunId || "—"})</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: tokens.grid }}>
                <Th muted={tokens.muted}>Date</Th>
                <Th muted={tokens.muted}>Time</Th>
                <Th muted={tokens.muted}>Symbol</Th>
                <Th muted={tokens.muted}>Side</Th>
                <Th muted={tokens.muted}>Size</Th>
                <Th muted={tokens.muted}>Entry</Th>
                <Th muted={tokens.muted}>Exit</Th>
                <Th muted={tokens.muted}>Fee</Th>
                <Th muted={tokens.muted}>P&L</Th>
                <Th muted={tokens.muted}>1R</Th>
                <Th muted={tokens.muted}>2R</Th>
                <Th muted={tokens.muted}>3R</Th>
                <Th muted={tokens.muted}>4R</Th>
                <Th muted={tokens.muted}>H/L</Th>
                <Th muted={tokens.muted}>Attach/Replace</Th>
                <Th muted={tokens.muted}>Actions</Th>
                <Th muted={tokens.muted}>R-Edit</Th>
              </tr>
            </thead>
            <tbody>
              {derived.rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr
                    className="border-b align-top"
                    style={{ borderColor: tokens.grid, transition: "background 120ms" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = hexToRgba(tokens.accent, 0.06)}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <Td>{r.date ? new Date(`${r.date}T00:00:00`).toLocaleDateString() : "—"}</Td>
                    <Td>{r.trade_time ? r.trade_time.slice(0,5) : "—"}</Td>
                    <Td>{r.symbol}</Td>
                    <Td>
                      <span className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: hexToRgba(r.direction === "short" ? tokens.danger : tokens.success, 0.12),
                          color: r.direction === "short" ? tokens.danger : tokens.success,
                          border: `1px solid ${hexToRgba(r.direction === "short" ? tokens.danger : tokens.success, 0.2)}`,
                        }}>
                        {String(r.direction || "").toUpperCase()}
                      </span>
                    </Td>
                    <Td>{r.size ?? "—"}</Td>
                    <Td>{r.entry ?? "—"}</Td>
                    <Td>{r.exit ?? "—"}</Td>
                    <Td>{fmtMoney(r.fee)}</Td>
                    <Td style={{ color: r.pnl >= 0 ? tokens.success : tokens.danger }}>{fmtMoney(r.pnl)}</Td>

                    {/* Possible-hit columns */}
                    {["1R","2R","3R","4R"].map((label, i) => {
                      const s = r.rr?.states?.[i] || null;
                      const bg = s === "Y" ? hexToRgba(tokens.success, 0.12)
                                : s === "N" ? hexToRgba(tokens.danger, 0.10)
                                : hexToRgba(tokens.warning, 0.15);
                      const color = s === "Y" ? tokens.success : s === "N" ? tokens.danger : tokens.warning;
                      const mark = s === "Y" ? "✓" : s === "N" ? "✗" : "?";
                      return (
                        <Td key={label}>
                          <span className="px-2 py-0.5 rounded-md text-xs" style={{ background: bg, color }}>
                            {mark}
                          </span>
                        </Td>
                      );
                    })}

                    {/* High/Low quick set */}
                    <Td>
                      <div className="text-[11px] leading-tight">
                        <div>H: {r.meta.high ?? "—"}</div>
                        <div>L: {r.meta.low  ?? "—"}</div>
                      </div>
                      <button
                        className="mt-1 px-2 py-1 rounded-lg text-xs border"
                        style={{ borderColor: tokens.grid }}
                        onClick={() => setHighLowForTrade(r)}
                      >
                        Set H/L
                      </button>
                    </Td>

                    <Td>
                      <label className="text-xs px-2 py-1 rounded-lg cursor-pointer inline-flex items-center gap-1 border" style={{ borderColor: tokens.grid }}>
                        {imageUploading === r.id ? "Uploading…" : "Upload"}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => attachFile(r.id, e.target.files?.[0])}
                        />
                      </label>
                      <div className="mt-1">
                        {r.attachment ? (
                          r.attachment.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? (
                            <a href={r.attachment} target="_blank" rel="noreferrer" title="Open image">
                              <img src={r.attachment} alt="attachment" className="h-12 w-12 object-cover rounded-lg" style={{ border: `1px solid ${tokens.grid}` }} />
                            </a>
                          ) : (
                            <a className="underline" href={r.attachment} target="_blank" rel="noreferrer">View file</a>
                          )
                        ) : (
                          <span className="text-xs" style={{ color: tokens.muted }}>None</span>
                        )}
                        {r.attachment && (
                          <div>
                            <button className="text-xs underline mt-1" onClick={() => removeAttachment(r.id)}>Remove</button>
                          </div>
                        )}
                      </div>
                    </Td>

                    <Td>
                      <button
                        className="px-2 py-1 rounded-lg text-xs border"
                        style={{ borderColor: tokens.grid, color: tokens.danger }}
                        onClick={() => deleteTrade(r.id)}
                      >
                        Delete
                      </button>
                    </Td>

                    {/* R-Edit toggle */}
                    <Td>
                      <button
                        className="px-2 py-1 rounded-lg text-xs border"
                        style={{ borderColor: tokens.grid }}
                        onClick={() => setExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                      >
                        {expanded[r.id] ? "Hide" : "R-Milestones"}
                      </button>
                    </Td>
                  </tr>

                  {/* Expandable R controls row (teal tinted) */}
                  {expanded[r.id] && (
                    <tr
                      style={{
                        background: hexToRgba(tokens.accent, 0.06),
                        borderTop: `1px solid ${tokens.grid}`,
                        borderBottom: `1px solid ${tokens.grid}`,
                      }}
                    >
                      <td className="px-3 py-3" colSpan={17}>
                        <RControls
                          tokens={tokens}
                          trade={r}
                          onChange={(levelIndex, { hit, time, clear }) => {
                            const idx = levelIndex + 1; // 1..4
                            const updates = {};
                            if (clear) {
                              updates[`R${idx}`] = null;
                              updates[`R${idx}T`] = null;
                            } else {
                              if (hit === true) updates[`R${idx}`] = "Y";
                              if (hit === false) updates[`R${idx}`] = "N";
                              if (time !== undefined) updates[`R${idx}T`] = time || null;
                            }
                            updateRTokens(r, updates);
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {derived.rows.length === 0 && (
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
  );
}

/* ------------- small UI bits ------------- */
function SummaryCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl p-3" style={{ border: `1px solid ${hexToRgba(accent, 0.25)}`, background: hexToRgba(accent, 0.06) }}>
      <div className="text-xs" style={{ color: hexToRgba(accent, 0.9) }}>{label}</div>
      <div className="text-lg font-semibold mt-1" style={{ color: hexToRgba(accent, 0.95) }}>{value}</div>
    </div>
  );
}
function Th({ children, muted }) {
  return <th className="py-2 pr-4 text-xs font-semibold" style={{ color: muted }}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`py-2 pr-4 ${className}`}>{children}</td>;
}
function CsvPreviewTable({ rows, muted, grid }) {
  if (!rows?.length) return <div className="text-xs" style={{ color: muted }}>Empty</div>;
  const headers = Object.keys(rows[0] || {});
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b" style={{ borderColor: grid }}>
            {headers.map((h) => (
              <th key={h} className="py-2 pr-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, i) => (
            <tr key={i} className="border-b" style={{ borderColor: grid }}>
              {headers.map((h) => (
                <td key={h} className="py-2 pr-4 whitespace-nowrap">
                  {String(row[h] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && <div className="text-xs mt-2" style={{ color: muted }}>Showing first 200 rows…</div>}
    </div>
  );
}
function Input({ label, value, onChange, type = "text", placeholder, muted, grid, accent }) {
  return (
    <div>
      <label className="text-xs" style={{ color: muted }}>{label}</label>
      <input
        className="w-full rounded-xl px-3 py-2 border focus:outline-none placeholder-opacity-70"
        style={{ borderColor: grid, background: hexToRgba(accent, 0.06), color: accent }}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
function Select({ label, value, onChange, options, muted, grid, accent }) {
  return (
    <div>
      <label className="text-xs" style={{ color: muted }}>{label}</label>
      <select
        className="w-full rounded-xl px-3 py-2 border focus:outline-none"
        style={{ borderColor: grid, background: hexToRgba(accent, 0.06), color: accent }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
function PerSymbolTable({ data, loading, muted, grid, success, danger, accent }) {
  return (
    <div className="rounded-2xl p-3" style={{ border: `1px solid ${grid}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Per-Symbol Breakdown</div>
        <div className="text-xs" style={{ color: muted }}>Wins & P&L by symbol</div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: grid }}>
              <Th muted={muted}>Symbol</Th>
              <Th muted={muted}># Trades</Th>
              <Th muted={muted}>Wins</Th>
              <Th muted={muted}>Losses</Th>
              <Th muted={muted}>Win %</Th>
              <Th muted={muted}>Net P&L</Th>
              <Th muted={muted}>Avg P&L</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr
                key={r.symbol}
                className="border-b"
                style={{ borderColor: grid }}
                onMouseEnter={(e) => e.currentTarget.style.background = hexToRgba(accent, 0.06)}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Td>{r.symbol}</Td>
                <Td>{r.trades}</Td>
                <Td>{r.wins}</Td>
                <Td>{r.losses}</Td>
                <Td>{r.winRate.toFixed(1)}%</Td>
                <Td style={{ color: r.netPnL >= 0 ? success : danger }}>{fmtMoney(r.netPnL)}</Td>
                <Td>{fmtMoney(r.avgPnL)}</Td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="py-4" style={{ color: muted }} colSpan={7}>
                  {loading ? "Loading…" : "No data for this run yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ====== R/R side panel ====== */
function RRPanel({ form, setForm, tokens }) {
  const entry = toNum(form.entry_price);
  const sl = toNum(form.sl);
  const dir = form.direction;

  const hasRisk = entry != null && sl != null && Number.isFinite(Math.abs(entry - sl)) && Math.abs(entry - sl) > 0;
  const R = hasRisk ? Math.abs(entry - sl) : null;

  function targetN(n) {
    if (!hasRisk) return null;
    return dir === "short" ? (entry - n * R) : (entry + n * R);
  }

  const t1 = targetN(1), t2 = targetN(2), t3 = targetN(3);

  const rr = (function() {
    const tp = toNum(form.tp);
    if (!hasRisk || tp == null) return null;
    return Math.abs(tp - entry) / R;
  })();

  return (
    <div className="rounded-xl p-3 h-full flex flex-col gap-2"
         style={{ border: `1px solid ${hexToRgba(tokens.accent, 0.35)}`, background: hexToRgba(tokens.accent, 0.06) }}>
      <div className="text-sm font-medium" style={{ color: tokens.accent }}>R/R Calculator</div>
      <div className="text-[11px]" style={{ color: tokens.muted }}>
        Uses Entry + Stop + Direction. We’ll stamp <code>SL:</code>/<code>TP:</code> into notes on save.
      </div>

      <div className="text-xs mt-1" style={{ color: tokens.muted }}>
        Risk (R): <strong style={{ color: tokens.accent }}>{hasRisk ? R : "—"}</strong>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <RRBox label="1R" value={t1} onClick={() => t1 != null && setForm(f => ({ ...f, tp: t1 }))} tokens={tokens}/>
        <RRBox label="2R" value={t2} onClick={() => t2 != null && setForm(f => ({ ...f, tp: t2 }))} tokens={tokens}/>
        <RRBox label="3R" value={t3} onClick={() => t3 != null && setForm(f => ({ ...f, tp: t3 }))} tokens={tokens}/>
      </div>

      <div className="text-xs mt-1" style={{ color: tokens.muted }}>
        Current TP: <strong style={{ color: tokens.accent }}>{form.tp || "—"}</strong>
        {rr != null && <span> • RR ≈ <strong style={{ color: tokens.accent }}>{rr.toFixed(2)}</strong></span>}
      </div>
    </div>
  );
}
function RRBox({ label, value, onClick, tokens }) {
  const clickable = value != null;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className="rounded-lg p-2 text-xs"
      style={{
        border: `1px solid ${hexToRgba(tokens.accent, 0.35)}`,
        background: hexToRgba(tokens.accent, 0.10),
        color: tokens.accent,
        opacity: clickable ? 1 : 0.5,
        cursor: clickable ? "pointer" : "default",
      }}
      title={clickable ? "Set TP to this level" : "Set Entry & Stop first"}
    >
      <div className="font-semibold">{label}</div>
      <div className="mt-0.5">{value != null ? value : "—"}</div>
    </button>
  );
}

/* ====== Inline R controls (teal tinted) ====== */
function RControls({ trade, tokens, onChange }) {
  const levels = trade?.rRec?.levels || [{}, {}, {}, {}];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[0,1,2,3].map((i) => {
        const lv = levels[i] || {};
        const label = `${i+1}R`;
        return (
          <div
            key={i}
            className="flex items-center justify-between rounded-2xl p-3 shadow-sm"
            style={{
              border: `1px solid ${hexToRgba(tokens.accent, 0.35)}`,
              background: hexToRgba(tokens.accent, 0.10),
            }}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-blue-600"
                checked={lv.state === "Y"}
                onChange={(e) => onChange(i, { hit: e.target.checked })}
              />
              <span className="text-sm font-semibold" style={{ color: tokens.accent }}>{label} Hit</span>
              {lv.state === "N" && <span className="text-xs" style={{ color: tokens.muted }}>(recorded: N)</span>}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: tokens.muted }}>Time</label>
              <input
                type="text"
                placeholder="hh:mm:ss"
                className="w-28 rounded-xl border px-2 py-1 text-sm"
                style={{ borderColor: tokens.grid, background: "white", color: "#111827" }}
                defaultValue={lv.time || ""}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) onChange(i, { time: null });
                  else if (hmsToSeconds(raw) != null) onChange(i, { time: raw });
                  else {
                    e.target.value = lv.time || "";
                    alert("Use hh:mm:ss (e.g., 00:12:30)");
                  }
                }}
              />
              <button className="text-xs underline" onClick={() => onChange(i, { clear: true })}>
                Clear
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
