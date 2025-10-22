// src/pages/TraderLab.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, ReferenceLine, LineChart, Line
} from "recharts";
import api, { apiPath } from "../api/axios";
import JournalPanel from "../components/JournalPanel";
import LotSizePanel from "../components/LotSizePanel.jsx";

/* ---------------- helpers ---------------- */
function num(v){ if(v===""||v==null) return null; const n=Number(v); return Number.isFinite(n)?n:null; }
const money = (v)=> (Number(v||0)).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:2});

const LAST_ACCOUNT_KEY = "qe:lastTraderLabAccountId";
const LAST_MONTH_FILTER_KEY = "qe:traderLabMonthFilter";
const LAST_TZ_KEY = "qe:traderLabTzShift";
const pnlMultKey = (runId)=>`qe:pnlMult:${runId||"default"}`;
const acctSizeKey = (runId)=>`qe:acctSize:${runId||"default"}`;

const tokens = {
  muted: "#9aa8bd",
  grid: "#263245",
  primary: "#4f46e5",
  success: "#16a34a",
  danger: "#ef4444",
  charts: ["#6366f1","#22c55e","#eab308","#ef4444","#06b6d4","#a855f7","#f97316","#14b8a6","#84cc16","#10b981","#fb7185","#60a5fa"],
};
function rgba(hex, a){
  const h=hex.replace("#",""); const s = h.length===3 ? h.split("").map(c=>c+c).join("") : h;
  const n=parseInt(s,16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return `rgba(${r},${g},${b},${a})`;
}
function winRateColor(rate){
  const r = Number(rate)||0;
  if (r < 40) return tokens.danger;
  if (r < 60) return "#f97316";
  if (r < 80) return "#facc15";
  return tokens.success;
}
/** Parse number from mixed text like "($12.34)" or "12.3 pips" */
function toNumberLoose(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  let s = String(x).trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /\b(loss|loser|red)\b/i.test(s);
  s = s.replace(/^\(|\)$/g, "").replace(/[^0-9.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
function pickFromNotes(notes, labels) {
  const txt = String(notes || "");
  for (const lab of labels) {
    const re = new RegExp(`${lab}\\s*[:=]?\\s*([\\$\\(\\)\\-0-9.,]+)`, "i");
    const m = txt.match(re);
    if (m && m[1] != null) {
      const v = toNumberLoose(m[1]);
      if (v !== null) return v;
    }
  }
  return null;
}
function shiftedWhen(dateStr, timeStr, tzShiftHours) {
  const hhmmss = (timeStr && /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) ? (timeStr.length===5?timeStr+":00":timeStr) : "00:00:00";
  const base = new Date(`${dateStr}T${hhmmss}`);
  if (isNaN(base.getTime())) return null;
  const d = new Date(base.getTime() + (Number(tzShiftHours)||0) * 3600 * 1000);
  const y = d.getFullYear(); const m = d.getMonth(); const dd = d.getDate();
  const hour = d.getHours(); const dowSun0 = d.getDay();
  const dowMon0 = (dowSun0 + 6) % 7;
  const dateShiftedStr = `${y}-${String(m+1).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
  return { js: d, year:y, month:m, day:dd, hour, dowMon0, monthKey: `${y}-${String(m+1).padStart(2,"0")}`, dateShiftedStr, timeShiftedStr: `${String(hour).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` };
}
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
async function reloadWithRetries(runId, fetchFn, setLoading, tries = 6) {
  setLoading(true);
  for (let i = 0; i < tries; i++) {
    const rows = await fetchFn(runId);
    if (Array.isArray(rows) && rows.length > 0) {
      setLoading(false);
      return rows;
    }
    await sleep(400 + i * 150);
  }
  const rows = await fetchFn(runId);
  setLoading(false);
  return rows;
}

/* -------- CSV normalizer (DEAL ignored) -------- */
function normalizeImportedRow(tRaw) {
  const t = { ...(tRaw || {}) };
  const get = (...aliases) => {
    for (const a of aliases) {
      if (t[a] != null) return t[a];
      const lower = a.toLowerCase();
      const hit = Object.keys(t).find(k => k.toLowerCase() === lower);
      if (hit) return t[hit];
    }
    return null;
  };
  let symbol = get("symbol", "sym", "ticker");
  if (symbol) t.symbol = String(symbol).toUpperCase();
  const type = String(get("direction","type","side") || "").toLowerCase();
  if (type) t.direction = /sell/.test(type) ? "short" : "long";
  const lots = get("size","qty","quantity","lots","contracts","shares");
  if (lots != null && t.size == null) t.size = toNumberLoose(lots);
  const openP = get("entry_price","open price","open_price","price_open");
  if (openP != null && t.entry_price == null) t.entry_price = toNumberLoose(openP);
  const closeP = get("exit_price","close price","close_price","price_close");
  if (closeP != null && t.exit_price == null) t.exit_price = toNumberLoose(closeP);
  const fee = get("fee","commission","fees");
  if (fee != null && t.fee == null) t.fee = toNumberLoose(fee) || 0;
  const profit = get("net_pnl","pnl","profit","realized_pnl","net pl","pl");
  if (profit != null && t.net_pnl == null) t.net_pnl = toNumberLoose(profit);

  // Duration (Column K). If present, we keep as temp and write into notes.
  const duration = get("duration","Duration","duration_min","duration (min)","dur","mins","minutes");
  if (duration != null && t.duration_min == null) {
    const d = toNumberLoose(duration);
    if (d != null) t.duration_min = d;
  }

  const sl = get("stop_loss","stop loss","sl");
  const tp = get("take_profit","take profit","tp");
  const parts = [];
  if (sl != null) parts.push(`SL: ${sl}`);
  if (tp != null) parts.push(`TP: ${tp}`);
  if (t.duration_min != null) parts.push(`DURATION_MIN=${t.duration_min}`);
  if (parts.length) {
    const pre = t.notes ? String(t.notes).trim() + " | " : "";
    t.notes = pre + parts.join(" | ");
  }

  const od = String(get("open date","open_date","date","timestamp") || "");
  if (od) {
    let ymd = "", hms = "00:00:00";
    const compact = od.replace(/\s+/g, "");
    let m = compact.match(/^(\d{4}-\d{2}-\d{2})(\d{2}:\d{2}:\d{2})$/);
    if (m) { ymd=m[1]; hms=m[2]; }
    else {
      m = od.match(/^(\d{4}-\d{2}-\d{2})[ T]?(\d{2}:\d{2}:\d{2})?$/);
      if (m) { ymd=m[1]; if (m[2]) hms=m[2]; }
    }
    if (ymd) { t.date = ymd; t.trade_time = hms; }
  }
  return t;
}

const TZ_CHOICES = [
  { label: "UTC−8 (PST)", value: -8 },{ label: "UTC−7 (MST)", value: -7 },
  { label: "UTC−6 (CST)", value: -6 },{ label: "UTC−5 (ET Std)", value: -5 },
  { label: "UTC−4 (ET Dst)", value: -4 },{ label: "UTC±0", value: 0 },
  { label: "UTC+1", value: 1 },{ label: "UTC+2", value: 2 },
  { label: "UTC+3", value: 3 },{ label: "UTC+4", value: 4 },
  { label: "UTC+5", value: 5 },{ label: "UTC+8", value: 8 },
];

/* ---------------- page ---------------- */
export default function TraderLab() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);

  const [pnlMult, setPnlMult] = useState(1);
  const [acctSize, setAcctSize] = useState(0);

  const [monthFilter, setMonthFilter] = useState(()=>{
    try { return localStorage.getItem(LAST_MONTH_FILTER_KEY) || "all"; } catch { return "all"; }
  });

  const [csvPreviewRows, setCsvPreviewRows] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [tzShift, setTzShift] = useState(()=>{
    try { return Number(localStorage.getItem(LAST_TZ_KEY) || -5); } catch { return -5; }
  });

  const [form, setForm] = useState({
    date: "", time_h: "9", time_ampm: "AM",
    symbol: "", direction: "long",
    size: "", entry_price: "", stop_price: "", target_price: "", fee: "",
    strategy: "", notes: "", duration_min: ""
  });
  const attachRef = useRef(null);
  const [attachFile, setAttachFile] = useState(null);

  const [showMgr, setShowMgr] = useState(false);
  const [notice, setNotice] = useState(null);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesContent, setNotesContent] = useState("");
  const [notesTitle, setNotesTitle] = useState("");
  const [notesTradeId, setNotesTradeId] = useState(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const reloadKeyRef = useRef(0);

  const flash = (type, text)=>{ setNotice({type, text}); setTimeout(()=>setNotice(null), 2400); };
  const updateForm = (patch)=> setForm(f=>({ ...f, ...patch }));

  useEffect(()=>{ loadAccounts(); }, []);
  async function loadAccounts(prefer=""){
    try{
      const {data} = await api.get(apiPath("/journal/backtests/runs"));
      const list = data || [];
      setAccounts(list);
      let stored = ""; try{ stored = localStorage.getItem(LAST_ACCOUNT_KEY)||""; }catch(e){}
      const first = (list[0] && list[0].id) ? String(list[0].id) : "";
      const want = prefer || stored;
      const sel = (want && list.some(r=>String(r.id)===String(want))) ? want : first;
      setAccountId(sel);
      if (sel){
        try{ localStorage.setItem(LAST_ACCOUNT_KEY, sel); }catch(e){}
        await loadTrades(sel);
        try {
          setPnlMult(Number(localStorage.getItem(pnlMultKey(sel)) || 1));
          setAcctSize(Number(localStorage.getItem(acctSizeKey(sel)) || 0));
        } catch {}
      } else {
        setTrades([]);
      }
    }catch(e){ console.error("loadAccounts",e); }
  }
  const fetchTrades = async (id) => {
    try{
      const {data} = await api.get(apiPath(`/journal/backtests/trades?run=${id}`));
      return Array.isArray(data) ? data : [];
    }catch(e){ console.error("fetchTrades", e); return []; }
  };
  async function loadTrades(id){
    setLoading(true);
    try{
      const rows = await fetchTrades(id);
      setTrades(rows);
    } catch (e) {
      if (e?.response?.status === 401) {
        setTimeout(() => { reloadKeyRef.current += 1; setReloadKey(reloadKeyRef.current); }, 0);
      }
    } finally{ setLoading(false); }
  }
  useEffect(() => { if (accountId) loadTrades(accountId); /* eslint-disable-next-line */ }, [reloadKey]);

  async function createAccount(){
    const name = window.prompt("Account name?");
    if(!name) return;
    try{
      const {data} = await api.post(apiPath("/journal/backtests/runs"), { name });
      await loadAccounts(String(data.id)); flash("ok","Account created");
    }catch{ window.alert("Failed to create account."); }
  }
  async function renameAccount(id){
    const name = window.prompt("Rename account:"); if(!name) return;
    try{ await api.patch(apiPath(`/journal/backtests/runs/${id}`), { name }); await loadAccounts(String(id)); flash("ok","Renamed"); }
    catch{ window.alert("Rename failed"); }
  }
  async function deleteAccount(id){
    if(!window.confirm("Delete this account and ALL its trades?")) return;
    try{ await api.delete(apiPath(`/journal/backtests/runs/${id}`)); await loadAccounts(""); flash("ok","Account deleted"); }
    catch{ window.alert("Delete failed"); }
  }

  function onCsvSelected(file){
    if(!file) return;
    setCsvFile(file);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: res=>{
        const raw = res.data || [];
        const normalized = raw.map(normalizeImportedRow);
        setCsvPreviewRows(normalized);
      },
      error: ()=>setCsvPreviewRows(null)
    });
  }

  async function importCsvIntoCurrent(){
    if(!csvFile || !accountId) return;
    setImporting(true);
    try{
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("run_id", String(accountId));
      fd.append("tz_shift_hours", String(Number.isFinite(tzShift) ? tzShift : 0));
      await api.post(apiPath("/journal/backtests/import_csv"), fd, { headers: { "Content-Type":"multipart/form-data" }});
      const rows = await reloadWithRetries(accountId, fetchTrades, setLoading, 6);
      setTrades(rows);
      setCsvFile(null); setCsvPreviewRows(null);
      flash("ok", `CSV imported`);
    }catch(e){
      const msg = (e?.response?.data?.detail) ||
                  (e?.response?.data?.errors?.join && e.response.data.errors.join("\n")) ||
                  "Import failed. Check columns.";
      window.alert(msg);
    } finally { setImporting(false); }
  }
  async function createAccountAndImport(){
    if(!csvFile) return;
    const name = window.prompt("New account name (from CSV):", csvFile.name.replace(/\.[^/.]+$/, "")); if(!name) return;
    try{
      const {data} = await api.post(apiPath("/journal/backtests/runs"), { name });
      const newId = String(data.id);
      setAccountId(newId);
      try{ localStorage.setItem(LAST_ACCOUNT_KEY, newId); }catch{}
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("run_id", newId);
      fd.append("tz_shift_hours", String(Number.isFinite(tzShift) ? tzShift : 0));
      await api.post(apiPath("/journal/backtests/import_csv"), fd, { headers: { "Content-Type":"multipart/form-data" }});
      const rows = await reloadWithRetries(newId, fetchTrades, setLoading, 6);
      setTrades(rows);
      await loadAccounts(newId);
      setCsvFile(null); setCsvPreviewRows(null);
      flash("ok", `Account created & CSV imported`);
    }catch(e){
      const msg = (e?.response?.data?.detail) ||
                  (e?.response?.data?.errors?.join && e.response.data.errors.join("\n")) ||
                  "Could not create account / import.";
      window.alert(msg);
    }
  }

  function to24(h,ampm){ let x=Number(h)||0; x=Math.min(Math.max(x,1),12); return (ampm==="AM")?(x===12?0:x):(x===12?12:x+12); }
  async function addTrade(e){
    e.preventDefault();
    if(!accountId){ window.alert("Pick or create an account first."); return; }
    try{
      const hour = to24(form.time_h, form.time_ampm);
      const trade_time = `${hour<10?"0":""}${hour}:00:00`;
      const parts = [];
      if (form.stop_price) parts.push("SL: "+form.stop_price);
      if (form.target_price) parts.push("TP: "+form.target_price);
      if (form.strategy) parts.push("STRATEGY: "+form.strategy);
      if (form.duration_min) parts.push("DURATION_MIN="+form.duration_min);
      parts.push("MODE: LIVE");
      const meta = parts.join(" | ");
      const notes = (meta ? meta+" | " : "") + (form.notes||"");

      if (attachFile){
        const fd = new FormData();
        fd.append("run", accountId);
        fd.append("date", form.date || new Date().toISOString().slice(0,10));
        fd.append("trade_time", trade_time);
        fd.append("symbol", (form.symbol||"").toUpperCase());
        fd.append("direction", form.direction);
        if(form.size) fd.append("size", form.size);
        if(form.entry_price) fd.append("entry_price", form.entry_price);
        fd.append("exit_price", "");
        fd.append("fee", form.fee || 0);
        fd.append("notes", notes);
        fd.append("attachment", attachFile);
        await api.post(apiPath("/journal/backtests/trades"), fd, { headers: { "Content-Type":"multipart/form-data" }});
      } else {
        await api.post(apiPath("/journal/backtests/trades"), {
          run: Number(accountId),
          date: form.date || new Date().toISOString().slice(0,10),
          trade_time,
          symbol: (form.symbol||"").toUpperCase(),
          direction: form.direction,
          size: num(form.size),
          entry_price: num(form.entry_price),
          exit_price: null,
          fee: num(form.fee)||0,
          notes,
        });
      }
      await loadTrades(accountId);
      setForm({ date:"", time_h:"9", time_ampm:"AM", symbol:"", direction:"long", size:"", entry_price:"", stop_price:"", target_price:"", fee:"", strategy:"", notes:"", duration_min:"" });
      setAttachFile(null); if(attachRef.current) attachRef.current.value="";
      flash("ok","Trade saved");
    }catch(err){ console.error(err); window.alert("Failed to add trade."); }
  }
  async function deleteTrade(id){
    if(!window.confirm("Delete this trade?")) return;
    try{ await api.delete(apiPath(`/journal/backtests/trades/${id}`)); await loadTrades(accountId); }catch{ window.alert("Delete failed"); }
  }
  async function uploadAttachment(tradeId, file){
    if(!file) return;
    const fd=new FormData(); fd.append("attachment", file);
    try{ await api.patch(apiPath(`/journal/backtests/trades/${tradeId}`), fd, { headers: { "Content-Type":"multipart/form-data" }}); await loadTrades(accountId); }
    catch{ window.alert("Upload failed"); }
  }
  async function removeAttachment(tradeId){
    try{ await api.post(apiPath(`/journal/backtests/trades/${tradeId}/remove-attachment`)); await loadTrades(accountId); }
    catch{ window.alert("Remove failed"); }
  }
  function openNotesEditor(t){
    setNotesTradeId(t.id);
    const shift = Number(localStorage.getItem(LAST_TZ_KEY) || tzShift || 0);
    const when = shiftedWhen(t.date, t.trade_time, shift);
    const ds = when ? when.dateShiftedStr : (t.date || "—");
    const ts = when ? when.timeShiftedStr : (t.trade_time?.slice(0,5) || "");
    setNotesTitle(`#${t.id} • ${t.symbol || "—"} • ${ds} ${ts}`);
    setNotesContent(t.notes || "");
    setNotesOpen(true);
  }
  async function saveNotes(){
    if (!notesTradeId) return;
    setSavingNotes(true);
    try{
      await api.patch(apiPath(`/journal/backtests/trades/${notesTradeId}`), { notes: notesContent || "" });
      setNotesOpen(false);
      await loadTrades(accountId);
      flash("ok","Notes updated");
    }catch(e){ console.error(e); window.alert("Failed to save notes."); }
    finally{ setSavingNotes(false); }
  }

  // Month options (shifted)
  const monthOptions = useMemo(()=>{
    const shift = Number(localStorage.getItem(LAST_TZ_KEY) || tzShift || 0);
    const set = new Set();
    (trades||[]).forEach(t=>{
      const w = shiftedWhen(t.date, t.trade_time, shift);
      if (w) set.add(w.monthKey);
    });
    return ["all"].concat(Array.from(set).sort().reverse());
  }, [trades, tzShift]);

  useEffect(()=>{ try { localStorage.setItem(LAST_MONTH_FILTER_KEY, monthFilter); } catch {} }, [monthFilter]);
  useEffect(()=>{ try { localStorage.setItem(LAST_TZ_KEY, String(tzShift)); } catch {} }, [tzShift]);
  useEffect(()=>{ if(accountId){ try { localStorage.setItem(pnlMultKey(accountId), String(pnlMult)); } catch {} } }, [pnlMult, accountId]);
  useEffect(()=>{ if(accountId){ try { localStorage.setItem(acctSizeKey(accountId), String(acctSize)); } catch {} } }, [acctSize, accountId]);

  /** ---------- P&L helpers ---------- */
  function pnlOfRaw(t) {
    const fieldCandidates = ["net_pnl","pnl","profit","realized_pnl","realized","gain","p_l","net_pl","netProfit","NetPL","PL"];
    for (const key of fieldCandidates) {
      if (t[key] != null) {
        const v = toNumberLoose(t[key]);
        if (v !== null) return v;
      }
    }
    const fromNotes = pickFromNotes(t?.notes, ["PNL","P&L","NET PNL","NET P&L","NET PROFIT","PROFIT","LOSS"]);
    if (fromNotes !== null) return fromNotes;

    const entry = toNumberLoose(t?.entry_price);
    const exit  = toNumberLoose(t?.exit_price);
    const size  = toNumberLoose(t?.size);
    const fee   = toNumberLoose(t?.fee) || 0;
    if (entry !== null && exit !== null && size !== null) {
      const dir = (t?.direction || "long").toLowerCase();
      const delta = dir === "short" ? (entry - exit) : (exit - entry);
      return delta * size - fee;
    }
    return 0;
  }
  const pnlOf = (t)=> pnlOfRaw(t) * (Number.isFinite(pnlMult)?pnlMult:1);

  /** ---------- Stats / Derived ---------- */
  const stats = useMemo(()=>{
    const allRows = trades||[];
    const shift = Number(localStorage.getItem(LAST_TZ_KEY) || tzShift || 0);

    const normalized = allRows.map(t => {
      const w = shiftedWhen(t.date, t.trade_time, shift);
      return { ...t, __when: w };
    }).filter(t => t.__when);

    const filtered = monthFilter==="all"
      ? normalized
      : normalized.filter(t => t.__when.monthKey === monthFilter);

    const withOutcome = filtered.map(t=>{
      let isWin = t.is_win;
      if (typeof isWin !== "boolean") {
        const res = String(t?.notes || "").match(/RESULT\s*[:=]\s*(WIN|LOSS)/i);
        if (res) isWin = res[1].toUpperCase() === "WIN";
      }
      if (typeof isWin !== "boolean") {
        const p = pnlOf(t);
        if (p > 0) isWin = true;
        else if (p < 0) isWin = false;
        else isWin = null;
      }
      return {...t, __is_win: isWin};
    });

    const totals = withOutcome.reduce((a,t)=>{
      const pnl = pnlOf(t);
      a.net += pnl;
      if (t.__is_win===true) a.wins++;
      else if (t.__is_win===false) a.losses++;
      return a;
    },{net:0,wins:0,losses:0});

    // Buckets by HOUR
    const buckets = Array.from({length:24},(_,h)=> ({hour:h,trades:0,wins:0,am:0,pm:0, profit:0}));
    withOutcome.forEach(t=>{
      const hh = t.__when.hour;
      const b = buckets[hh];
      b.trades += 1;
      if (hh<12) b.am += 1; else b.pm += 1;
      if (t.__is_win===true) b.wins += 1;
      b.profit += pnlOf(t);
    });
    const hourData = buckets.map(b=> ({
      hour:b.hour,
      winRate: b.trades?(b.wins/b.trades*100):0,
      amTrades: b.am,
      pmTrades: b.pm,
      profit: b.profit,
      avgProfit: b.trades ? (b.profit/b.trades) : 0
    }));

    // Per-day aggregation
    const byDay = {};
    withOutcome.forEach(t=>{
      const key = t.__when.dateShiftedStr;
      if (!byDay[key]) byDay[key] = { date:key, pnl:0, trades:0 };
      byDay[key].pnl += pnlOf(t);
      byDay[key].trades += 1;
    });
    const dayRows = Object.values(byDay).sort((a,b)=> a.date.localeCompare(b.date));

    // Equity curve + Max DD
    let cumulative = Number(acctSize)||0;
    const equityCurve = dayRows.map(d=>{ cumulative += d.pnl; return { date:d.date, balance:cumulative, pnl:d.pnl }; });
    let peak = Number(acctSize)||0, maxDD=0;
    equityCurve.forEach(p=>{ peak = Math.max(peak, p.balance); maxDD = Math.max(maxDD, peak - p.balance); });

    // Day of week summaries
    const dow = Array.from({length:7},()=>({trades:0,wins:0,pnl:0}));
    const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    withOutcome.forEach(t=>{
      const i = t.__when.dowMon0;
      dow[i].trades += 1;
      if (t.__is_win===true) dow[i].wins += 1;
      dow[i].pnl += pnlOf(t);
    });
    const dowChart = dow.map((d,i)=> ({ name:names[i], trades:d.trades, winRate: d.trades ? (d.wins/d.trades*100) : 0, pnl:d.pnl }));
    let bestDay = null;
    for (let i=0;i<dow.length;i++){
      const wr = dow[i].trades ? (dow[i].wins/dow[i].trades) : 0;
      if (!bestDay || wr > bestDay.wr) bestDay = { label:names[i], wr: Math.round(wr*100) };
    }

    const uniqueDays = dayRows.length;
    const avgPerDay = uniqueDays ? (totals.net / uniqueDays) : 0;
    const avgTradesPerDay = uniqueDays ? ((withOutcome.length) / uniqueDays) : 0;

    // Best/Worst day (by pnl)
    let bestDayPnl = null, worstDayPnl = null;
    dayRows.forEach(d=>{
      if (bestDayPnl===null || d.pnl > bestDayPnl.pnl) bestDayPnl = d;
      if (worstDayPnl===null || d.pnl < worstDayPnl.pnl) worstDayPnl = d;
    });

    // ---------- PAYOUT RULES ----------
    const acct = Number(acctSize)||0;
    const minDayDollar = acct * 0.005;  // 0.5% of account
    const needMinDays = 7;
    const needProfitPct = 0.07;         // 7% target
    const consistencyCap = 0.15;        // 15% rule

    // A) Minimum profitable days ≥ 0.5% each
    const qualifyingDays = dayRows.filter(d => d.pnl >= minDayDollar);
    const minDaysMet = qualifyingDays.length >= needMinDays;

    // B) Profit target (net vs account)
    const profitTargetDollar = acct * needProfitPct;
    const profitTargetMet = totals.net >= profitTargetDollar;

    // C) 15% Consistency: Highest positive day <= 15% of total positive profit
    const posOnly = dayRows.filter(d => d.pnl > 0);
    const totalPositiveProfit = posOnly.reduce((s,d)=>s+d.pnl,0);
    const highestProfitDay = posOnly.length ? Math.max(...posOnly.map(d=>d.pnl)) : 0;
    const minTotalForConsistency = highestProfitDay / consistencyCap; // required positive profit total
    const consistencyMet = totalPositiveProfit >= minTotalForConsistency || highestProfitDay===0;

    // Suggest missing amounts
    const needMoreForConsistency = Math.max(0, minTotalForConsistency - totalPositiveProfit);
    const needMoreForTarget = Math.max(0, profitTargetDollar - totals.net);
    const needMoreMinDays = Math.max(0, needMinDays - qualifyingDays.length);

    return {
      filtered: withOutcome,
      totals, hourData, dowChart, bestDay, avgPerDay, avgTradesPerDay,
      dayRows, equityCurve, maxDD, bestDayPnl, worstDayPnl,
      // payout
      payout: {
        minDayDollar,
        qualifyingDaysCount: qualifyingDays.length,
        needMinDays, minDaysMet,
        profitTargetDollar, profitTargetMet,
        consistencyCap, highestProfitDay, totalPositiveProfit,
        minTotalForConsistency, consistencyMet,
        needMoreForConsistency, needMoreForTarget, needMoreMinDays,
      }
    };
  }, [trades, monthFilter, pnlMult, tzShift, acctSize]);

  // ---------- UI ----------
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Equity curve hero */}
      <div className="rounded-2xl border p-3 md:p-4" style={{borderColor:tokens.grid, background:"linear-gradient(180deg, rgba(79,70,229,0.08), rgba(2,6,23,0))"}}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-sm" style={{color:tokens.muted}}>Account Growth</div>
          <div className="text-xs" style={{color:tokens.muted}}>
            Start: <span style={{color:"#e5edf7"}}>{money(acctSize)}</span> •
            Current: <span style={{color:"#e5edf7"}}>{money(acctSize + stats.totals.net)}</span>
          </div>
        </div>
        <div style={{height:220}}>
          <ResponsiveContainer>
            <AreaChart data={stats.equityCurve}>
              <defs>
                <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke={tokens.muted} tickFormatter={(d)=>d.slice(5)} />
              <YAxis stroke={tokens.muted} tickFormatter={v=>money(v)} width={80}/>
              <ReTooltip
                contentStyle={{ borderRadius: 12, background: "#0b1220", border: "1px solid "+tokens.grid, color: "#e5edf7" }}
                formatter={(v,n)=>[ n==="balance" ? money(v) : money(v), n==="balance" ? "Balance" : "P&L" ]}
                labelFormatter={(d)=> new Date(d+"T00:00:00").toLocaleDateString()}
              />
              <ReferenceLine y={acctSize} stroke="#94a3b8" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="balance" name="Balance" stroke="#818cf8" fill="url(#gradBalance)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Header + controls */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">TraderLab (Live)</h1>
          <div className="text-xs" style={{color:tokens.muted}}>
            trades: {stats.filtered ? stats.filtered.length : 0} • win rate: {((stats.filtered?.length? (stats.filtered.filter(t=>t.__is_win===true).length / stats.filtered.length *100):0)).toFixed(1)}%
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="px-3 py-2 rounded-lg text-white text-sm" style={{background:tokens.primary}} onClick={createAccount}>New Account</button>

          <select className="qe-select text-sm" value={accountId}
            onChange={async (e)=>{ const id=e.target.value; setAccountId(id); try{localStorage.setItem(LAST_ACCOUNT_KEY,id);}catch{} if(id) await loadTrades(id); else setTrades([]); }}
            title="Select account" style={{minWidth: 260}}>
            {(accounts||[]).map(a=> <option key={a.id} value={a.id}>{a.name || ("Acc "+a.id)}</option>)}
            {(!accounts||accounts.length===0) && <option value="">No accounts</option>}
          </select>

          <select className="qe-select text-sm" value={monthFilter} onChange={(e)=>setMonthFilter(e.target.value)} title="Filter by month (shifted)">
            {monthOptions.map(opt=> <option key={opt} value={opt}>{opt==="all" ? "All months" : opt}</option>)}
          </select>

          <select className="qe-select text-sm" value={tzShift} onChange={(e)=>setTzShift(Number(e.target.value))} title="Apply hour shift">
            {TZ_CHOICES.map(z=> <option key={String(z.value)} value={z.value}>{z.label}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs" style={{color:tokens.muted}}>P&L ×</label>
            <input className="qe-field" style={{ width: 70 }} type="number" step="1" value={pnlMult} onChange={(e)=> setPnlMult(Number(e.target.value||1))}/>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{color:tokens.muted}}>Account size</label>
            <input className="qe-field" style={{ width: 110 }} type="number" step="0.01" value={acctSize} onChange={(e)=> setAcctSize(Number(e.target.value||0))}/>
          </div>

          <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:tokens.grid}} onClick={()=>setShowMgr(true)}>Manage</button>

          <label className="px-3 py-2 rounded-lg border text-sm cursor-pointer" style={{borderColor:tokens.grid}}>
            Upload CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e)=> onCsvSelected(e.target.files && e.target.files[0])}/>
          </label>
        </div>
      </header>

      {notice && (
        <div className="rounded-lg px-3 py-2 text-sm"
          style={ notice.type==="ok"
            ? {background:"rgba(16,185,129,.12)", color:"#10b981", border:"1px solid rgba(16,185,129,.3)"}
            : {background:"rgba(239,68,68,.12)", color:"#ef4444", border:"1px solid rgba(239,68,68,.3)"} }>
          {notice.text}
        </div>
      )}

      {csvPreviewRows && (
        <div className="rounded-xl border p-3 md:p-4" style={{borderColor:tokens.grid}}>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div className="font-medium">CSV Preview (first {Math.min(200,csvPreviewRows.length)} rows)</div>
            <div className="flex items-center gap-2">
              <select className="qe-select text-sm" value={tzShift} onChange={(e)=>setTzShift(Number(e.target.value))} title="Apply hour shift while importing">
                {TZ_CHOICES.map(z=> <option key={String(z.value)} value={z.value}>{z.label}</option>)}
              </select>
              <button className="px-3 py-2 rounded-lg text-white text-sm" style={{background:tokens.primary}} disabled={importing} onClick={importCsvIntoCurrent}>{importing?"Importing…":"Import to Account"}</button>
              <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:tokens.grid}} onClick={createAccountAndImport}>Create Account & Import</button>
              <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:tokens.grid}} onClick={()=>{ setCsvPreviewRows(null); setCsvFile(null); }}>Discard</button>
            </div>
          </div>
          <CsvPreview rows={csvPreviewRows}/>
          <div className="text-xs mt-2" style={{color:tokens.muted}}>
            Columns are flexible. <strong>DEAL ignored.</strong> SL/TP and Duration are added to notes automatically.
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
        <KPI label="# Trades" value={stats.filtered ? stats.filtered.length : 0}/>
        <KPI label="Wins" value={stats.filtered?.filter(t=>t.__is_win===true).length || 0}/>
        <KPI label="Losses" value={stats.filtered?.filter(t=>t.__is_win===false).length || 0}/>
        <KPI label="Net P&L" value={money(stats.totals.net)}/>
        <KPI label="Account Size" value={money(acctSize)}/>
        <KPI label="Balance" value={money(acctSize + stats.totals.net)}/>
        <KPI label="Avg P&L / Day" value={money(stats.avgPerDay)}/>
        <KPI label="Max Drawdown" value={money(stats.maxDD)}/>
      </div>

      {/* Payout Consistency Card */}
      <PayoutCard payout={stats.payout} />

      {/* Hourly chart */}
      <div className="rounded-xl border p-3" style={{borderColor:tokens.grid}}>
        <div className="text-sm mb-2" style={{color:tokens.muted}}>Win %, AM/PM Trades, P&L & Avg/Trade by Hour</div>
        <div style={{height:260}}>
          <ResponsiveContainer>
            <BarChart data={stats.hourData}>
              <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickFormatter={(h)=>String(h).padStart(2,"0")} stroke={tokens.muted}/>
              <YAxis yAxisId="left" domain={[0,100]} tickFormatter={(v)=>v+"%"} stroke={tokens.muted}/>
              <YAxis yAxisId="rightCount" orientation="right" allowDecimals={false} stroke={tokens.muted}/>
              <YAxis yAxisId="rightProfit" orientation="right" hide />
              <Legend wrapperStyle={{ color: tokens.muted }} />
              <ReTooltip
                contentStyle={{ borderRadius: 12, background: "#0b1220", border: "1px solid "+tokens.grid, color: "#e5edf7" }}
                formatter={(value, name)=>{
                  if (name === "Win %") return [ (value && value.toFixed ? value.toFixed(0) : value) + "%", "Win %" ];
                  if (name === "P&L") return [ money(value), "P&L" ];
                  if (name === "Avg/Trade") return [ money(value), "Avg/Trade" ];
                  return [value, name];
                }}
                labelFormatter={(h)=> "Hour " + String(h).padStart(2,"0") + ":00" }
              />
              <Bar name="Win %" dataKey="winRate" yAxisId="left">
                {stats.hourData.map((d,i)=> <Cell key={i} fill={winRateColor(d.winRate)} />)}
              </Bar>
              <Bar name="AM Trades" dataKey="amTrades" yAxisId="rightCount" fill="#94a3b8" />
              <Bar name="PM Trades" dataKey="pmTrades" yAxisId="rightCount" fill="#60a5fa" />
              <Line type="monotone" name="P&L" dataKey="profit" yAxisId="rightProfit" dot={false} stroke="#38bdf8" strokeWidth={2}/>
              <Line type="monotone" name="Avg/Trade" dataKey="avgProfit" yAxisId="rightProfit" dot={false} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Day-of-week + summaries */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-3 md:col-span-2" style={{borderColor:tokens.grid}}>
          <div className="text-sm mb-2" style={{color:tokens.muted}}>Best Day to Trade (Win% & Trades)</div>
          <div style={{height:220}}>
            <ResponsiveContainer>
              <BarChart data={stats.dowChart}>
                <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={tokens.muted}/>
                <YAxis yAxisId="left" domain={[0,100]} tickFormatter={(v)=>v+"%"} stroke={tokens.muted}/>
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} stroke={tokens.muted}/>
                <Legend wrapperStyle={{ color: tokens.muted }} />
                <ReTooltip contentStyle={{ borderRadius: 12, background: "#0b1220", border: "1px solid "+tokens.grid, color: "#e5edf7" }}/>
                <Bar name="Win %" dataKey="winRate" yAxisId="left">
                  {stats.dowChart.map((d,i)=> <Cell key={i} fill={winRateColor(d.winRate)} />)}
                </Bar>
                <Bar name="Trades" dataKey="trades" yAxisId="right" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border p-3" style={{borderColor:tokens.grid}}>
          <div className="text-sm mb-2 flex items-center justify-between" style={{color:tokens.muted}}>
            <span>P&L by Day of Week</span>
            <span className="text-xs">Avg/day: <span style={{color:"#e5edf7"}}>{money(stats.avgPerDay)}</span></span>
          </div>
          <div className="space-y-2">
            {stats.dowChart.map(d=>(
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span>{d.name}</span>
                <span style={{color: (d.pnl>=0?tokens.success:tokens.danger)}}>{money(d.pnl)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs" style={{color:tokens.muted}}>
            Best Day: <span style={{color:"#e5edf7"}}>{stats.bestDayPnl ? `${new Date(stats.bestDayPnl.date+"T00:00:00").toLocaleDateString()} • ${money(stats.bestDayPnl.pnl)}` : "—"}</span><br/>
            Worst Day: <span style={{color:"#e5edf7"}}>{stats.worstDayPnl ? `${new Date(stats.worstDayPnl.date+"T00:00:00").toLocaleDateString()} • ${money(stats.worstDayPnl.pnl)}` : "—"}</span>
          </div>
        </div>
      </div>

      <LotSizePanel runId={accountId} trades={stats.filtered} pnlOf={pnlOf} />

      {/* Journal + Add Trade */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <JournalPanel compact runId={accountId} />
        </div>

        <div className="rounded-xl border p-3 md:p-4" style={{borderColor:tokens.grid}}>
          <div className="font-medium mb-3">Add Trade (Live)</div>
          <form onSubmit={addTrade} className="grid grid-cols-1 gap-3">
            <Input label="Date" type="date" value={form.date} onChange={(v)=>updateForm({date:v})}/>
            <div className="grid grid-cols-3 gap-3">
              <Select label="Hour" value={form.time_h} onChange={(v)=>updateForm({time_h:v})}
                options={Array.from({length:12},(_,i)=>({label:String(i+1), value:String(i+1)}))}/>
              <Select label="AM/PM" value={form.time_ampm} onChange={(v)=>updateForm({time_ampm:v})}
                options={[{label:"AM",value:"AM"},{label:"PM",value:"PM"}]}/>
              <Select label="Side" value={form.direction} onChange={(v)=>updateForm({direction:v})}
                options={[{label:"Long",value:"long"},{label:"Short",value:"short"}]}/>
            </div>

            <Input label="Symbol" value={form.symbol} onChange={(v)=>updateForm({symbol:v})} placeholder="XAUUSD / EURUSD / AAPL"/>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Size" value={form.size} onChange={(v)=>updateForm({size:v})} placeholder="0.01 lots or shares"/>
              <Input label="Entry" value={form.entry_price} onChange={(v)=>updateForm({entry_price:v})}/>
              <Input label="Fee" value={form.fee} onChange={(v)=>updateForm({fee:v})} placeholder="0"/>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input label="Stop (SL)" value={form.stop_price} onChange={(v)=>updateForm({stop_price:v})}/>
              <Input label="Target (TP)" value={form.target_price} onChange={(v)=>updateForm({target_price:v})}/>
              <Input label="Strategy" value={form.strategy} onChange={(v)=>updateForm({strategy:v})} placeholder="Breakout A"/>
            </div>

            <Input label="Duration (min)" value={form.duration_min} onChange={(v)=>updateForm({duration_min:v})} />

            <div>
              <label className="text-xs" style={{color:tokens.muted}}>Notes</label>
              <textarea className="qe-field mt-1" rows={2} value={form.notes} onChange={(e)=>updateForm({notes:e.target.value})}/>
            </div>

            <div>
              <label className="text-xs" style={{color:tokens.muted}}>Attachment (optional)</label>
              <input ref={attachRef} type="file" accept="image/*,application/pdf" onChange={(e)=>setAttachFile((e.target.files && e.target.files[0]) ? e.target.files[0] : null)}/>
            </div>

            <button className="px-4 py-2 rounded-lg text-white w-full" style={{background:tokens.primary}} type="submit">Add Trade</button>
          </form>
        </div>
      </div>

      {/* Trades table */}
      <div className="rounded-xl border p-3 md:p-4" style={{borderColor:tokens.grid}}>
        <div className="font-medium mb-2">Trades {accountId && "(Account "+accountId+")"}</div>
        <div className="overflow-auto">
          <table className="min-w-full text-[13px]" style={{tableLayout:"fixed"}}>
            <thead>
              <tr className="text-left border-b" style={{borderColor:tokens.grid}}>
                <Th style={{width:50}}>#</Th>
                <Th style={{width:110}}>Date</Th>
                <Th style={{width:70}}>Time</Th>
                <Th style={{width:120}}>Symbol</Th>
                <Th style={{width:80}}>Side</Th>
                <Th style={{width:90}}>Size</Th>
                <Th style={{width:90}}>Fee</Th>
                <Th style={{width:110}}>P&L</Th>
                <Th style={{width:110}}>Duration</Th>
                <Th style={{width:130}}>Strategy</Th>
                <Th style={{width:140}}>Notes</Th>
                <Th style={{width:110}}>Attachment</Th>
                <Th style={{width:90}}>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {(stats.filtered||[]).map((t,idx)=>{
                const stratM = (t.notes||"").match(/STRATEGY:\s*([^|]+)/i);
                const stratTxt = stratM && stratM[1] ? stratM[1].trim() : "";
                const pnl = pnlOf(t);
                const rowNo = stats.filtered.length - idx;

                const ds = t.__when?.dateShiftedStr || t.date || "—";
                const ts = t.__when?.timeShiftedStr || (t.trade_time ? String(t.trade_time).slice(0,5) : "—");
                const durM = (()=>{ const m = String(t.notes||"").match(/DURATION_MIN\s*=?\s*([0-9]+(?:\.[0-9]+)?)/i); return m? Number(m[1]) : null; })();

                return (
                  <tr key={t.id} className="border-b align-top" style={{borderColor:tokens.grid}}
                      onMouseEnter={(e)=>{e.currentTarget.style.background=rgba("#ffffff",0.035);}}
                      onMouseLeave={(e)=>{e.currentTarget.style.background="transparent";}}>
                    <Td><span className="px-2 py-0.5 text-[11px] rounded-md" style={{background:"#1f2937", color:"#d1d5db"}} title={"Trade id "+t.id}>{rowNo}</span></Td>
                    <Td>{ds ? new Date(ds+"T00:00:00").toLocaleDateString() : "—"}</Td>
                    <Td>{ts}</Td>
                    <Td className="truncate" title={t.symbol || ""}>{t.symbol}</Td>
                    <Td>
                      <span className="px-1.5 py-0.5 text-[11px] rounded-md"
                            style={{background: t.direction==="short"?rgba(tokens.danger,.15):rgba(tokens.success,.15),
                                    color: t.direction==="short"?tokens.danger:tokens.success}}>
                        {String(t.direction||"").toUpperCase()}
                      </span>
                    </Td>
                    <Td>{t.size ?? "—"}</Td>
                    <Td>{money(t.fee)}</Td>
                    <Td style={{color:(pnl>=0)?tokens.success:tokens.danger, fontWeight:600}}>{money(pnl)}</Td>
                    <Td>{durM!=null ? `${durM.toFixed(0)} min` : <span style={{color:tokens.muted}}>—</span>}</Td>
                    <Td className="truncate" title={stratTxt || ""}>{stratTxt || "—"}</Td>
                    <Td>
                      {(t.notes && t.notes.trim())
                        ? <button className="px-2 py-1 text-xs rounded-md border" style={{borderColor:tokens.grid}} onClick={()=>openNotesEditor(t)}>Edit</button>
                        : <button className="px-2 py-1 text-xs rounded-md border" style={{borderColor:tokens.grid}} onClick={()=>openNotesEditor(t)}>Add</button>}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs px-2 py-1 rounded-lg border cursor-pointer inline-block text-center" style={{borderColor:tokens.grid}}>
                          Upload
                          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e)=>uploadAttachment(t.id, (e.target.files && e.target.files[0]) || null)}/>
                        </label>
                        {t.attachment ? (
                          /\.(png|jpg|jpeg|webp|gif)$/i.test(t.attachment)
                            ? <a className="text-xs underline text-center" href={t.attachment} target="_blank" rel="noreferrer">view</a>
                            : <a className="text-xs underline text-center" href={t.attachment} target="_blank" rel="noreferrer">file</a>
                        ) : <span className="text-xs text-center" style={{color:tokens.muted}}>—</span>}
                        {t.attachment && <button className="text-xs underline text-center" onClick={()=>removeAttachment(t.id)}>Remove</button>}
                      </div>
                    </Td>
                    <Td>
                      <button className="px-2 py-1 text-xs rounded-lg border"
                              style={{borderColor:tokens.grid, color:tokens.danger, background:rgba(tokens.danger,0.06)}}
                              onClick={()=>deleteTrade(t.id)}>Delete</button>
                    </Td>
                  </tr>
                );
              })}
              {(!stats.filtered || stats.filtered.length===0) && (
                <tr><td className="py-4" style={{color:tokens.muted}} colSpan={13}>{loading?"Loading…":"No trades yet. Try uploading a CSV."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showMgr && (
        <AccountManager
          accounts={accounts}
          selectedId={accountId}
          onClose={()=>setShowMgr(false)}
          onSelect={async (id)=>{ setAccountId(String(id)); try{localStorage.setItem(LAST_ACCOUNT_KEY,String(id));}catch{} await loadTrades(String(id));
            try{ setPnlMult(Number(localStorage.getItem(pnlMultKey(id))||1)); setAcctSize(Number(localStorage.getItem(acctSizeKey(id))||0)); }catch{} }}
          onRename={renameAccount} onDelete={deleteAccount}
        />
      )}

      {notesOpen && (
        <NotesModal title={notesTitle} content={notesContent} setContent={setNotesContent}
                    onClose={()=>setNotesOpen(false)} onSave={saveNotes} saving={savingNotes} />
      )}
    </div>
  );
}

/* ------------ UI atoms & components ------------ */
function KPI({label,value}) {
  return (
    <div className="rounded-xl border p-3" style={{borderColor:tokens.grid}}>
      <div className="text-xs" style={{color:tokens.muted}}>{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
function Th(props){ return <th className="py-2 pr-3 text-[11px] font-semibold" style={{color:tokens.muted, ...(props.style||{})}}>{props.children}</th>; }
function Td(props){ return <td className={"py-1.5 pr-3 "+(props.className||"")}>{props.children}</td>; }
function Input(props){
  const handleChange = React.useCallback((e)=>{ props.onChange?.(e.target.value); }, [props.onChange]);
  return (
    <div className={props.className || ""}>
      <label className="text-xs" style={{color:tokens.muted}}>{props.label}</label>
      <input className="qe-field mt-1" type={props.type || "text"} value={props.value} onChange={handleChange} placeholder={props.placeholder}/>
    </div>
  );
}
function Select(props){
  const handleChange = React.useCallback((e)=>{ props.onChange?.(e.target.value); }, [props.onChange]);
  return (
    <div className={props.className || ""}>
      <label className="text-xs" style={{color:tokens.muted}}>{props.label}</label>
      <select className="qe-select mt-1" value={props.value} onChange={handleChange}>
        {props.options.map(o=> <option key={String(o.value)} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function CsvPreview({rows}){
  rows = rows || [];
  if (!rows.length) return <div className="text-xs" style={{color:tokens.muted}}>Empty</div>;
  const headers = Object.keys(rows[0] || {});
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b" style={{borderColor:tokens.grid}}>
            {headers.map(h=> <th key={h} className="py-2 pr-4 text-xs" style={{color:tokens.muted}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0,200).map((row,i)=>(
            <tr key={i} className="border-b" style={{borderColor:tokens.grid}}
                onMouseEnter={(e)=>{e.currentTarget.style.background=rgba("#ffffff",0.035);}}
                onMouseLeave={(e)=>{e.currentTarget.style.background="transparent";}}>
              {headers.map(h=> <td key={h} className="py-2 pr-4 whitespace-nowrap">{String(row[h] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length>200 && <div className="text-xs mt-2" style={{color:tokens.muted}}>Showing first 200 rows…</div>}
    </div>
  );
}
function AccountManager({accounts,selectedId,onClose,onSelect,onRename,onDelete}){
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="rounded-xl border p-4 w-full max-w-sm bg-[#0b1220]" style={{borderColor:tokens.grid}}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Accounts</div>
          <button className="text-xs underline" onClick={onClose}>Close</button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {(accounts||[]).map(a=>(
            <div key={a.id} className="flex items-center justify-between gap-2 py-1">
              <button className="text-left flex-1 underline truncate"
                      style={{color: String(selectedId)===String(a.id) ? "#e5edf7" : tokens.muted}}
                      title={a.name || ("Acc "+a.id)} onClick={()=>onSelect(a.id)}>
                {a.name || ("Acc "+a.id)}
              </button>
              <div className="flex items-center gap-2">
                <button className="text-xs underline" onClick={()=>onRename(a.id)}>Rename</button>
                <button className="text-xs underline" style={{color:tokens.danger}} onClick={()=>onDelete(a.id)}>Delete</button>
              </div>
            </div>
          ))}
          {(!accounts || accounts.length===0) && <div className="text-xs" style={{color:tokens.muted}}>No accounts yet.</div>}
        </div>
      </div>
    </div>
  );
}
function NotesModal({ title, content, setContent, onClose, onSave, saving }){
  const copy = () => { try { navigator.clipboard.writeText(content || ""); } catch {} };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl bg-[#0b1220] rounded-xl border" style={{borderColor:tokens.grid}}>
        <div className="p-3 md:p-4 border-b" style={{borderColor:tokens.grid}}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium truncate" title={title}>{title || "Notes"}</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 text-xs rounded-md border" style={{borderColor:tokens.grid}} onClick={copy}>Copy</button>
              <button className="px-2 py-1 text-xs rounded-md border" style={{borderColor:tokens.grid}} onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
        <div className="p-3 md:p-4">
          <textarea className="qe-field w-full" rows={12} value={content} onChange={(e)=>setContent?.(e.target.value)} placeholder="Write notes for this trade (free text)."/>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:tokens.grid}} onClick={onClose}>Cancel</button>
            <button className="px-3 py-2 rounded-lg text-white text-sm disabled:opacity-60" style={{background:tokens.primary}} onClick={onSave} disabled={!!saving}>
              {saving ? "Saving…" : "Save Notes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function PayoutCard({ payout }){
  const metAll = payout.minDaysMet && payout.profitTargetMet && payout.consistencyMet;
  return (
    <div className="rounded-2xl border p-4 md:p-5" style={{borderColor:tokens.grid, background:"rgba(255,255,255,0.02)"}}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">Payout Consistency</div>
        <div className={"px-3 py-1 rounded-full text-xs font-medium"}
             style={{background: metAll? "rgba(16,185,129,.15)" : "rgba(148,163,184,.15)",
                     color: metAll? "#10b981" : "#94a3b8"}}>
          {metAll ? "Ready" : "Not Yet"}
        </div>
      </div>

      {/* three-line block like screenshot */}
      <div className="rounded-xl border p-3 md:p-4 space-y-3" style={{borderColor:tokens.grid, background:"rgba(255,255,255,0.03)"}}>
        <Row label="Highest Profit Day" value={money(payout.highestProfitDay)} />
        <Divider />
        <Row label="Current Total Profit (positive days only)" value={money(payout.totalPositiveProfit)} />
        <Divider />
        <Row label={`Minimum required total profit (15%)`} value={money(payout.minTotalForConsistency)} icon="⏱" />
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-4">
        <Mini
          title="Min Profitable Days (≥ 0.5%)"
          value={`${payout.qualifyingDaysCount} / ${payout.needMinDays}`}
          ok={payout.minDaysMet}
          hint={!payout.minDaysMet ? `Need ${payout.needMoreMinDays} more day(s) ≥ ${money(payout.minDayDollar)}` : "Met"}
        />
        <Mini
          title="Profit Target (≥ 7%)"
          value={payout.profitTargetMet ? "Met" : "Not Yet"}
          ok={payout.profitTargetMet}
          hint={!payout.profitTargetMet ? `Need ${money(payout.needMoreForTarget)} more net profit` : "Met"}
        />
        <Mini
          title="Consistency (≤ 15% on best day)"
          value={payout.consistencyMet ? "Compliant" : "Not Yet"}
          ok={payout.consistencyMet}
          hint={!payout.consistencyMet ? `Gain ${money(payout.needMoreForConsistency)} more on other days` : "Met"}
        />
      </div>
    </div>
  );
}
function Row({label,value,icon}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2">{icon ? <span>{icon}</span> : null}{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
function Divider(){ return <div className="h-px" style={{background:tokens.grid}}/>; }
function Mini({title,value,ok,hint}) {
  return (
    <div className="rounded-xl border p-3" style={{borderColor:tokens.grid}}>
      <div className="text-xs" style={{color:tokens.muted}}>{title}</div>
      <div className="text-base font-semibold mt-1" style={{color: ok ? tokens.success : "#e5edf7"}}>{value}</div>
      <div className="text-xs mt-1" style={{color:tokens.muted}}>{hint}</div>
    </div>
  );
}
