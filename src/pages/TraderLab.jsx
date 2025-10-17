// src/pages/TraderLab.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { api } from "../api/axios";
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
  const h=hex.replace("#","");
  const s = h.length===3 ? h.split("").map(c=>c+c).join("") : h;
  const n=parseInt(s,16);
  const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return `rgba(${r},${g},${b},${a})`;
}
function winRateColor(rate){
  const r = Number(rate)||0;
  if (r < 40) return tokens.danger;
  if (r < 60) return "#f97316";
  if (r < 80) return "#facc15";
  return tokens.success;
}

/** Parse a number from mixed currency/parentheses text like "($12.34)", "1,250.00", "12.3 pips" */
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

/** Extract a numeric value from the notes by a list of labels */
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

/** 0=Mon..6=Sun */
function jsDowIndex(isoDate) {
  const dt = new Date(isoDate+"T00:00:00");
  return (dt.getDay()+6)%7;
}

/** small wait */
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

/** after import, poll until trades are visible (handles eventual consistency) */
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

/* -------- CSV header flexibility (DEAL is optional/ignored) -------- */
/**
 * Many MT4/5 and cTrader exports look like:
 * SYM, OPEN DATE, OPEN PRICE, CLOSE DATE, CLOSE PRICE, TYPE, STOP LOSS, TAKE PROFIT, LOTS, PROFIT, ...
 * Dates can be like 2025-10-0314:14:25 (no space/T).
 * We only use this for local preview and to show users the mapping works; the server import does its own parse.
 */
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

  // symbol
  let symbol = get("symbol", "sym", "ticker");
  if (symbol) t.symbol = String(symbol).toUpperCase();

  // direction (BUY/SELL → long/short)
  const type = String(get("direction","type","side") || "").toLowerCase();
  if (type) t.direction = /sell/.test(type) ? "short" : "long";

  // size / prices
  const lots = get("size","qty","quantity","lots","contracts","shares");
  if (lots != null && t.size == null) t.size = toNumberLoose(lots);

  const openP = get("entry_price","open price","open_price","price_open");
  if (openP != null && t.entry_price == null) t.entry_price = toNumberLoose(openP);

  const closeP = get("exit_price","close price","close_price","price_close");
  if (closeP != null && t.exit_price == null) t.exit_price = toNumberLoose(closeP);

  const fee = get("fee","commission","fees");
  if (fee != null && t.fee == null) t.fee = toNumberLoose(fee) || 0;

  // PROFIT → net_pnl
  const profit = get("net_pnl","pnl","profit","net pl","pl","realized_pnl");
  if (profit != null && t.net_pnl == null) t.net_pnl = toNumberLoose(profit);

  // SL/TP → append to notes (if present). DEAL is explicitly ignored.
  const sl = get("stop_loss","stop loss","sl");
  const tp = get("take_profit","take profit","tp");
  const parts = [];
  if (sl != null) parts.push(`SL: ${sl}`);
  if (tp != null) parts.push(`TP: ${tp}`);
  if (parts.length) {
    const pre = t.notes ? String(t.notes).trim() + " | " : "";
    t.notes = pre + parts.join(" | ");
  }

  // date + time from OPEN DATE
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
  { label: "UTC−8 (PST)", value: -8 },
  { label: "UTC−7 (MST)", value: -7 },
  { label: "UTC−6 (CST)", value: -6 },
  { label: "UTC−5 (ET Standard)", value: -5 },
  { label: "UTC−4 (ET Daylight)", value: -4 },
  { label: "UTC−3", value: -3 },
  { label: "UTC−2", value: -2 },
  { label: "UTC−1", value: -1 },
  { label: "UTC±0", value: 0 },
  { label: "UTC+1", value: 1 },
  { label: "UTC+2", value: 2 },
  { label: "UTC+3", value: 3 },
  { label: "UTC+4", value: 4 },
  { label: "UTC+5", value: 5 },
  { label: "UTC+8", value: 8 },
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
    date: "",
    time_h: "9",
    time_ampm: "AM",
    symbol: "",
    direction: "long",
    size: "",
    entry_price: "",
    stop_price: "",
    target_price: "",
    fee: "",
    strategy: "",
    notes: "",
  });
  const attachRef = useRef(null);
  const [attachFile, setAttachFile] = useState(null);

  const [showMgr, setShowMgr] = useState(false);
  const [notice, setNotice] = useState(null);

  // NOTES MODAL (now editable)
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesContent, setNotesContent] = useState("");
  const [notesTitle, setNotesTitle] = useState("");
  const [notesTradeId, setNotesTradeId] = useState(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const flash = (type, text)=>{ setNotice({type, text}); setTimeout(()=>setNotice(null), 2400); };

  function updateForm(patch){
    setForm(f=>({ ...f, ...patch }));
  }

  useEffect(()=>{ loadAccounts(); }, []);
  async function loadAccounts(prefer=""){
    try{
      const {data} = await api.get("/api/journal/backtests/runs/");
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
      const {data} = await api.get("/api/journal/backtests/trades/", { params: { run: id } });
      return Array.isArray(data) ? data : [];
    }catch(e){
      console.error("fetchTrades", e);
      return [];
    }
  };

  async function loadTrades(id){
    setLoading(true);
    try{
      const rows = await fetchTrades(id);
      setTrades(rows);
    }finally{
      setLoading(false);
    }
  }

  async function createAccount(){
    const name = window.prompt("Account name?");
    if(!name) return;
    try{
      const {data} = await api.post("/api/journal/backtests/runs/", { name });
      await loadAccounts(String(data.id));
      flash("ok","Account created");
    }catch{ window.alert("Failed to create account."); }
  }
  async function renameAccount(id){
    const name = window.prompt("Rename account:");
    if(!name) return;
    try{
      await api.patch("/api/journal/backtests/runs/"+id+"/", { name });
      await loadAccounts(String(id));
      flash("ok","Renamed");
    }catch{ window.alert("Rename failed"); }
  }
  async function deleteAccount(id){
    if(!window.confirm("Delete this account and ALL its trades?")) return;
    try{
      await api.delete("/api/journal/backtests/runs/"+id+"/");
      await loadAccounts("");
      flash("ok","Account deleted");
    }catch{ window.alert("Delete failed"); }
  }

  function onCsvSelected(file){
    if(!file) return;
    setCsvFile(file);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: res=>{
        const raw = res.data || [];
        // show a normalized preview so users see what will be used
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
      const { data } = await api.post("/api/journal/backtests/import_csv/", fd, { headers: { "Content-Type":"multipart/form-data" }});
      // Retry-poll until trades show up
      const rows = await reloadWithRetries(accountId, fetchTrades, setLoading, 6);
      setTrades(rows);
      setCsvFile(null); setCsvPreviewRows(null);
      flash("ok", `CSV imported (${data?.imported ?? rows.length}/${data?.rows_parsed ?? "?"})`);
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
      const {data} = await api.post("/api/journal/backtests/runs/", { name });
      const newId = String(data.id);
      setAccountId(newId);
      try{ localStorage.setItem(LAST_ACCOUNT_KEY, newId); }catch{}
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("run_id", newId);
      fd.append("tz_shift_hours", String(Number.isFinite(tzShift) ? tzShift : 0));
      const resp = await api.post("/api/journal/backtests/import_csv/", fd, { headers: { "Content-Type":"multipart/form-data" }});
      // Retry-poll after creating new account
      const rows = await reloadWithRetries(newId, fetchTrades, setLoading, 6);
      setTrades(rows);
      await loadAccounts(newId);
      const d = resp?.data||{};
      flash("ok", `Account created & CSV imported (${d.imported ?? rows.length}/${d.rows_parsed ?? "?"})`);
      setCsvFile(null); setCsvPreviewRows(null);
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
        await api.post("/api/journal/backtests/trades/", fd, { headers: { "Content-Type":"multipart/form-data" }});
      } else {
        await api.post("/api/journal/backtests/trades/", {
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
      setForm({
        date:"", time_h:"9", time_ampm:"AM", symbol:"", direction:"long",
        size:"", entry_price:"", stop_price:"", target_price:"", fee:"",
        strategy:"", notes:""
      });
      setAttachFile(null); if(attachRef.current) attachRef.current.value="";
      flash("ok","Trade saved");
    }catch(err){ console.error(err); window.alert("Failed to add trade."); }
  }
  async function deleteTrade(id){
    if(!window.confirm("Delete this trade?")) return;
    try{ await api.delete("/api/journal/backtests/trades/"+id+"/"); await loadTrades(accountId); }catch{ window.alert("Delete failed"); }
  }
  async function uploadAttachment(tradeId, file){
    if(!file) return;
    const fd=new FormData(); fd.append("attachment", file);
    try{ await api.patch("/api/journal/backtests/trades/"+tradeId+"/", fd, { headers: { "Content-Type":"multipart/form-data" }}); await loadTrades(accountId); }
    catch{ window.alert("Upload failed"); }
  }
  async function removeAttachment(tradeId){
    try{ await api.post("/api/journal/backtests/trades/"+tradeId+"/remove-attachment/"); await loadTrades(accountId); }
    catch{ window.alert("Remove failed"); }
  }

  // open editable notes modal for a trade
  function openNotesEditor(t){
    setNotesTradeId(t.id);
    setNotesTitle(`#${t.id} • ${t.symbol || "—"} • ${t.date || "—"} ${t.trade_time?.slice(0,5)||""}`);
    setNotesContent(t.notes || "");
    setNotesOpen(true);
  }
  async function saveNotes(){
    if (!notesTradeId) return;
    setSavingNotes(true);
    try{
      await api.patch(`/api/journal/backtests/trades/${notesTradeId}/`, { notes: notesContent || "" });
      setNotesOpen(false);
      await loadTrades(accountId);
      flash("ok","Notes updated");
    }catch(e){
      console.error(e);
      window.alert("Failed to save notes.");
    }finally{
      setSavingNotes(false);
    }
  }

  const monthOptions = useMemo(()=>{
    const set = new Set();
    (trades||[]).forEach(t=>{
      if(!t.date) return;
      const parts = String(t.date).split("-");
      if(parts.length>=2) set.add(parts[0]+"-"+parts[1]);
    });
    return ["all"].concat(Array.from(set).sort().reverse());
  }, [trades]);

  useEffect(()=>{ try { localStorage.setItem(LAST_MONTH_FILTER_KEY, monthFilter); } catch {} }, [monthFilter]);
  useEffect(()=>{ try { localStorage.setItem(LAST_TZ_KEY, String(tzShift)); } catch {} }, [tzShift]);
  useEffect(()=>{ if(accountId){ try { localStorage.setItem(pnlMultKey(accountId), String(pnlMult)); } catch {} } }, [pnlMult, accountId]);
  useEffect(()=>{ if(accountId){ try { localStorage.setItem(acctSizeKey(accountId), String(acctSize)); } catch {} } }, [acctSize, accountId]);

  /** ---------- Robust P&L extraction ---------- */
  function pnlOfRaw(t) {
    const fieldCandidates = [
      "net_pnl","pnl","profit","realized_pnl","realized","gain","p_l","net_pl","netProfit","NetPL","PL"
    ];
    for (const key of fieldCandidates) {
      if (t[key] != null) {
        const v = toNumberLoose(t[key]);
        if (v !== null) return v;
      }
    }
    const fromNotes = pickFromNotes(t?.notes, [
      "PNL","P&L","NET PNL","NET P&L","NET PROFIT","PROFIT","LOSS"
    ]);
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

  const stats = useMemo(()=>{
    const allRows = trades||[];
    const filtered = monthFilter==="all" ? allRows : allRows.filter(t=> String(t.date||"").startsWith(monthFilter));

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
    const winRate = withOutcome.length ? (totals.wins/withOutcome.length*100) : 0;

    const buckets = Array.from({length:24},(_,h)=> ({hour:h,trades:0,wins:0,am:0,pm:0}));
    withOutcome.forEach(t=>{
      if(!t.trade_time) return;
      const hh = Number(String(t.trade_time).split(":")[0]);
      if(!(hh>=0&&hh<=23)) return;
      const b = buckets[hh];
      b.trades += 1;
      if (hh<12) b.am += 1; else b.pm += 1;
      if (t.__is_win===true) b.wins += 1;
    });
    const hourData = buckets.map(b=> ({
      hour:b.hour,
      winRate: b.trades?(b.wins/b.trades*100):0,
      amTrades: b.am,
      pmTrades: b.pm,
    }));

    const counts = {};
    withOutcome.forEach(t=>{ const s=(t.symbol||"—").toUpperCase(); counts[s]=(counts[s]||0)+1; });
    const pie = Object.keys(counts).map(k=> ({name:k, value:counts[k]})).sort((a,b)=>b.value-a.value).slice(0,12);

    const dow = Array.from({length:7},()=>({trades:0,wins:0,pnl:0}));
    const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    withOutcome.forEach(t=>{
      if(!t.date) return;
      const i = jsDowIndex(t.date);
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

    const uniqueDays = new Set(withOutcome.map(t=>t.date).filter(Boolean));
    const avgPerDay = uniqueDays.size ? (totals.net / uniqueDays.size) : 0;

    let sumScore = 0, countScore = 0;
    const flagCounts = {}, mistakeCounts = {};
    withOutcome.forEach(t=>{
      const notes = String(t.notes || "");
      const mV2Score = notes.match(/JRNL_V2:[\s\S]*?SCORE\s*=\s*(\d+)/i);
      if (mV2Score) { sumScore += Number(mV2Score[1]||0); countScore++; }
      const mV2Mistakes = notes.match(/MISTAKES\s*=\s*([^\s;|]+)/i);
      if (mV2Mistakes) {
        mV2Mistakes[1].split(",").map(s=>s.trim().toLowerCase()).filter(Boolean)
          .forEach(tag=>{ if(tag!=="none") mistakeCounts[tag] = (mistakeCounts[tag]||0)+1; });
      }
      const mFlags = notes.match(/JRNL_FLAGS:\s*([^\|]+)/i);
      if (mFlags) {
        mFlags[1].split(",").map(s=>s.trim().toLowerCase()).filter(Boolean)
          .forEach(f=>{ if(f!=="none") flagCounts[f] = (flagCounts[f]||0) + 1; });
      }
    });
    const avgJournal = countScore ? Math.round(sumScore / countScore) : 0;

    const topFlags = Object.keys(flagCounts).map(k=>({key:k, count:flagCounts[k]})).sort((a,b)=>b.count-a.count).slice(0,3);
    const topMistakes = Object.keys(mistakeCounts).map(k=>({key:k, count:mistakeCounts[k]})).sort((a,b)=>b.count-a.count).slice(0,5);

    return { filtered: withOutcome, totals, winRate, pie, hourData, avgJournal, topFlags, topMistakes, dowChart, bestDay, avgPerDay };
  }, [trades, monthFilter, pnlMult]);

  /* ---------- UI ---------- */
  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">TraderLab (Live)</h1>
          <div className="text-xs" style={{color:tokens.muted}}>
            trades: {stats.filtered ? stats.filtered.length : 0} • wins: {stats.totals.wins} • losses: {stats.totals.losses} • win rate: {stats.winRate.toFixed(1)}%
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="px-3 py-2 rounded-lg text-white text-sm" style={{background:tokens.primary}} onClick={createAccount}>New Account</button>

          <select
            className="qe-select text-sm"
            value={accountId}
            onChange={async (e)=>{ const id=e.target.value; setAccountId(id); try{localStorage.setItem(LAST_ACCOUNT_KEY,id);}catch{} if(id) await loadTrades(id); else setTrades([]); }}
            title="Select account"
            style={{minWidth: 260}}
          >
            {(accounts||[]).map(a=> <option key={a.id} value={a.id}>{a.name || ("Acc "+a.id)}</option>)}
            {(!accounts||accounts.length===0) && <option value="">No accounts</option>}
          </select>

          <select
            className="qe-select text-sm"
            value={monthFilter}
            onChange={(e)=>setMonthFilter(e.target.value)}
            title="Filter by month"
          >
            {monthOptions.map(opt=> <option key={opt} value={opt}>{opt==="all" ? "All months" : opt}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs" style={{color:tokens.muted}}>P&L ×</label>
            <input
              className="qe-field"
              style={{ width: 70 }}
              type="number"
              step="1"
              value={pnlMult}
              onChange={(e)=> setPnlMult(Number(e.target.value||1))}
              title="Multiply all computed P&L by this factor (set 100 if your CSV is in cents/pips)"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{color:tokens.muted}}>Account size</label>
            <input
              className="qe-field"
              style={{ width: 110 }}
              type="number"
              step="0.01"
              value={acctSize}
              onChange={(e)=> setAcctSize(Number(e.target.value||0))}
              title="Starting account balance for this run"
            />
          </div>

          <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:tokens.grid}} onClick={()=>setShowMgr(true)}>Manage</button>

          <label className="px-3 py-2 rounded-lg border text-sm cursor-pointer" style={{borderColor:tokens.grid}}>
            Upload CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e)=> onCsvSelected(e.target.files && e.target.files[0])}/>
          </label>
        </div>
      </header>

      {notice && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={ notice.type==="ok"
            ? {background:"rgba(16,185,129,.12)", color:"#10b981", border:"1px solid rgba(16,185,129,.3)"}
            : {background:"rgba(239,68,68,.12)", color:"#ef4444", border:"1px solid rgba(239,68,68,.3)"} }
        >
          {notice.text}
        </div>
      )}

      {csvPreviewRows && (
        <div className="rounded-xl border p-3 md:p-4" style={{borderColor:tokens.grid}}>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div className="font-medium">CSV Preview (first {Math.min(200,csvPreviewRows.length)} rows)</div>
            <div className="flex items-center gap-2">
              <select
                className="qe-select text-sm"
                value={tzShift}
                onChange={(e)=>setTzShift(Number(e.target.value))}
                title="Apply this hour shift to timestamps while importing"
              >
                {TZ_CHOICES.map(z=> <option key={String(z.value)} value={z.value}>{z.label}</option>)}
              </select>
              <button className="px-3 py-2 rounded-lg text-white text-sm" style={{background:tokens.primary}} disabled={importing} onClick={importCsvIntoCurrent}>{importing?"Importing…":"Import to Account"}</button>
              <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:tokens.grid}} onClick={createAccountAndImport}>Create Account & Import</button>
              <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:tokens.grid}} onClick={()=>{ setCsvPreviewRows(null); setCsvFile(null); }}>Discard</button>
            </div>
          </div>
          <CsvPreview rows={csvPreviewRows}/>
          <div className="text-xs mt-2" style={{color:tokens.muted}}>
            Expected columns are flexible. <strong>DEAL is optional and ignored.</strong> SL/TP are appended to notes automatically.
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
        <KPI label="# Trades" value={stats.filtered ? stats.filtered.length : 0}/>
        <KPI label="Wins" value={stats.totals.wins}/>
        <KPI label="Losses" value={stats.totals.losses}/>
        <KPI label="Net P&L" value={money(stats.totals.net)}/>
        <KPI label="Avg Journal Score" value={stats.avgJournal || 0}/>
        <KPI label="Best Day (Win%)" value={stats.bestDay ? (stats.bestDay.label + " • " + stats.bestDay.wr + "%") : "—"}/>
        <KPI label="Account Size" value={money(acctSize)}/>
        <KPI label="Balance" value={money(acctSize + stats.totals.net)}/>
      </div>

      {/* charts row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-3" style={{borderColor:tokens.grid}}>
          <div className="text-sm mb-2" style={{color:tokens.muted}}>Top Symbols (by trades)</div>
          <div style={{height:220}}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.pie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={95} paddingAngle={2}>
                  {stats.pie.map((_,i)=><Cell key={i} stroke="#0b1220" strokeWidth={1} fill={tokens.charts[i%tokens.charts.length]} />)}
                </Pie>
                <ReTooltip contentStyle={{ borderRadius:12, background:"#0b1220", border:"1px solid "+tokens.grid, color:"#e5edf7" }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-xs" style={{color:tokens.muted}}>
            {(stats.topFlags?.length) || (stats.topMistakes?.length) ? (
              <div>
                {stats.topMistakes?.length ? (
                  <>
                    <div className="font-medium mb-1" style={{color:"#e5edf7"}}>Top mistakes</div>
                    <ul className="list-disc" style={{marginLeft:20, marginBottom:8}}>
                      {stats.topMistakes.map(f=> <li key={f.key}>{f.key} ({f.count})</li>)}
                    </ul>
                  </>
                ) : null}
                {stats.topFlags?.length ? (
                  <>
                    <div className="font-medium mb-1" style={{color:"#e5edf7"}}>Discipline flags</div>
                    <ul className="list-disc" style={{marginLeft:20}}>
                      {stats.topFlags.map(f=> <li key={f.key}>{f.key} ({f.count})</li>)}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : <span>No issues yet.</span>}
          </div>
        </div>

        <div className="rounded-xl border p-3 md:col-span-2" style={{borderColor:tokens.grid}}>
          <div className="text-sm mb-2" style={{color:tokens.muted}}>Win % and AM/PM Trades by Hour</div>
          <div style={{height:220}}>
            <ResponsiveContainer>
              <BarChart data={stats.hourData}>
                <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(h)=>String(h).padStart(2,"0")} stroke={tokens.muted}/>
                <YAxis yAxisId="left" domain={[0,100]} tickFormatter={(v)=>v+"%"} stroke={tokens.muted}/>
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} stroke={tokens.muted}/>
                <Legend wrapperStyle={{ color: tokens.muted }} />
                <ReTooltip
                  contentStyle={{ borderRadius: 12, background: "#0b1220", border: "1px solid "+tokens.grid, color: "#e5edf7" }}
                  formatter={(value, name)=>{
                    if (name === "Win %") return [ (value && value.toFixed ? value.toFixed(0) : value) + "%", "Win %" ];
                    return [value, name];
                  }}
                  labelFormatter={(h)=> "Hour " + String(h).padStart(2,"0") + ":00" }
                />
                <Bar name="Win %" dataKey="winRate" yAxisId="left">
                  {stats.hourData.map((d,i)=> <Cell key={i} fill={winRateColor(d.winRate)} />)}
                </Bar>
                <Bar name="AM Trades" dataKey="amTrades" yAxisId="right" fill="#94a3b8" />
                <Bar name="PM Trades" dataKey="pmTrades" yAxisId="right" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Best Day + P&L by Day */}
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
                <ReTooltip
                  contentStyle={{ borderRadius: 12, background: "#0b1220", border: "1px solid "+tokens.grid, color: "#e5edf7" }}
                  formatter={(value, name)=>{
                    if (name === "Win %") return [ (value && value.toFixed ? value.toFixed(0) : value) + "%", "Win %" ];
                    if (name === "Trades") return [value, "Trades"];
                    return [value, name];
                  }}
                />
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
            <span>P&L by Day</span>
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
        </div>
      </div>

      <LotSizePanel runId={accountId} trades={stats.filtered} pnlOf={pnlOf} />

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
                <Th style={{width:90}}>Journal</Th>
                <Th style={{width:150}}>Mistakes</Th>
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
                const jScoreV2 = (t.notes||"").match(/JRNL_V2:[\s\S]*?SCORE\s*=\s*(\d+)/i);
                const jScoreLegacy = (t.notes||"").match(/JRNL_SCORE:\s*(\d+)/i);
                const jScore = jScoreV2 ? jScoreV2[1] : (jScoreLegacy ? jScoreLegacy[1] : null);
                const mCsv = (t.notes||"").match(/MISTAKES\s*=\s*([^\s;|]+)/i);
                const mistakes = mCsv && mCsv[1] && mCsv[1].toLowerCase()!=="none"
                  ? mCsv[1].split(",").map(s=>s.trim()).filter(Boolean)
                  : [];
                const pnl = pnlOf(t);
                const rowNo = stats.filtered.length - idx;

                return (
                  <tr key={t.id} className="border-b align-top"
                      style={{borderColor:tokens.grid, background:rgba("#0ea5e9",0.045)}}
                      onMouseEnter={(e)=>{e.currentTarget.style.background=rgba("#0ea5e9",0.085);}}
                      onMouseLeave={(e)=>{e.currentTarget.style.background=rgba("#0ea5e9",0.045);}}>
                    <Td><span className="px-2 py-0.5 text-[11px] rounded-md" style={{background:"#1f2937", color:"#d1d5db"}} title={"Trade id "+t.id}>{rowNo}</span></Td>
                    <Td>{t.date ? new Date(String(t.date)+"T00:00:00").toLocaleDateString() : "—"}</Td>
                    <Td>{t.trade_time ? String(t.trade_time).slice(0,5) : "—"}</Td>
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

                    <Td>{jScore ? <span title="Discipline Score">{jScore}</span> : <span style={{color:tokens.muted}}>—</span>}</Td>
                    <Td>
                      {mistakes.length
                        ? <div className="flex flex-wrap gap-1" style={{maxWidth:220}}>{mistakes.map(m=>(
                            <span key={m} className="px-1.5 py-0.5 border rounded-md text-[11px]" style={{borderColor:tokens.grid}}>{m}</span>
                          ))}</div>
                        : <span style={{color:tokens.muted}}>—</span>}
                    </Td>

                    <Td className="truncate" title={stratTxt}>{stratTxt || "—"}</Td>

                    <Td>
                      <div className="flex items-center gap-2">
                        {(t.notes && t.notes.trim())
                          ? <button
                              className="px-2 py-1 text-xs rounded-md border"
                              style={{borderColor:tokens.grid}}
                              onClick={()=>openNotesEditor(t)}
                            >Edit</button>
                          : <button
                              className="px-2 py-1 text-xs rounded-md border"
                              style={{borderColor:tokens.grid}}
                              onClick={()=>openNotesEditor(t)}
                            >Add</button>}
                      </div>
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
                <tr><td className="py-4" style={{color:tokens.muted}} colSpan={14}>{loading?"Loading…":"No trades yet."}</td></tr>
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
          onSelect={async (id)=>{
            setAccountId(String(id));
            try{localStorage.setItem(LAST_ACCOUNT_KEY,String(id));}catch{}
            await loadTrades(String(id));
            try{
              setPnlMult(Number(localStorage.getItem(pnlMultKey(id))||1));
              setAcctSize(Number(localStorage.getItem(acctSizeKey(id))||0));
            }catch{}
          }}
          onRename={renameAccount}
          onDelete={deleteAccount}
        />
      )}

      {notesOpen && (
        <NotesModal
          title={notesTitle}
          content={notesContent}
          setContent={setNotesContent}
          onClose={()=>setNotesOpen(false)}
          onSave={saveNotes}
          saving={savingNotes}
        />
      )}
    </div>
  );
}

/* ------------ UI atoms ------------ */
function KPI(props){
  return (
    <div className="rounded-xl border p-3" style={{borderColor:tokens.grid}}>
      <div className="text-xs" style={{color:tokens.muted}}>{props.label}</div>
      <div className="text-lg font-semibold mt-1">{props.value}</div>
    </div>
  );
}
function Th(props){
  return <th className="py-2 pr-3 text-[11px] font-semibold" style={{color:tokens.muted, ...(props.style||{})}}>{props.children}</th>;
}
function Td(props){
  return <td className={"py-1.5 pr-3 "+(props.className||"")}>{props.children}</td>;
}

function Input(props){
  const handleChange = React.useCallback((e)=>{ props.onChange?.(e.target.value); }, [props.onChange]);
  return (
    <div className={props.className || ""}>
      <label className="text-xs" style={{color:tokens.muted}}>{props.label}</label>
      <input
        className="qe-field mt-1"
        type={props.type || "text"}
        value={props.value}
        onChange={handleChange}
        placeholder={props.placeholder}
      />
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

function CsvPreview(props){
  const rows = props.rows || [];
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
            <tr key={i} className="border-b" style={{borderColor:tokens.grid, background:rgba("#06b6d4",0.06)}}
                onMouseEnter={(e)=>{e.currentTarget.style.background=rgba("#06b6d4",0.12);}}
                onMouseLeave={(e)=>{e.currentTarget.style.background=rgba("#06b6d4",0.06);}}>
              {headers.map(h=> <td key={h} className="py-2 pr-4 whitespace-nowrap">{String(row[h] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length>200 && <div className="text-xs mt-2" style={{color:tokens.muted}}>Showing first 200 rows…</div>}
    </div>
  );
}

/* ---- slimmer Account Manager ---- */
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
                      title={a.name || ("Acc "+a.id)}
                      onClick={()=>onSelect(a.id)}>
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

/* ---- Notes Modal (editable) ---- */
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
          <textarea
            className="qe-field w-full"
            rows={12}
            value={content}
            onChange={(e)=>setContent?.(e.target.value)}
            placeholder="Write notes for this trade (free text)."
          />
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
