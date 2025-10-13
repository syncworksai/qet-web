// src/pages/Backtesting.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

/* ---------- small helpers ---------- */
function numOrNull(v){ if(v===""||v==null) return null; const n=Number(v); return Number.isFinite(n)?n:null; }
const money = (v)=> (Number(v||0)).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:2});
function ampmTo24(h12, ampm){
  let h = Number(h12)||0; h = Math.min(Math.max(h,1),12);
  if ((ampm||"AM").toUpperCase()==="AM") return h===12?0:h;
  return h===12?12:(h+12);
}
const LAST_RUN_KEY = "qe:lastBacktestRunId";

/* Win-rate color scale */
function winRateColor(rate){
  const r = Number(rate)||0;
  if (r < 40) return "#ef4444";      // red
  if (r < 60) return "#f97316";      // orange
  if (r < 80) return "#facc15";      // yellow
  return "#16a34a";                  // green
}

/* Simple CSV template content */
const CSV_TEMPLATE = [
  ["Date","Time","Symbol","Side","Entry Price","Exit Price","Size","Commission","Strategy","Notes"],
  ["2025-10-07","19:00","XAUUSD","Long","2350.00","2351.50","1","0","GOLD A","example note"],
].map(r=>r.join(",")).join("\n");

export default function Backtesting() {
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedRun, setSelectedRun] = useState(null);

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  /* Run manager + CSV preview */
  const [showRunMgr, setShowRunMgr] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);

  // simplified form (+ outcome)
  const [form, setForm] = useState({
    date: "",
    trade_hour: "9",
    trade_ampm: "AM",
    symbol: "",
    direction: "long",
    pips: "",
    size_lots: "",
    fee: "",
    entry_price: "",
    exit_price: "",
    strategy: "",
    notes: "",
    outcome: "", // "", "win", "loss"
  });

  const flash = (type, text) => { setNotice({type, text}); setTimeout(()=>setNotice(null), 2500); };

  useEffect(() => {
    const last = (() => { try { return localStorage.getItem(LAST_RUN_KEY) || ""; } catch { return ""; }})();
    loadRuns(last);
  }, []);

  async function loadRuns(preferId = "") {
    try{
      const {data} = await api.get("/api/journal/backtests/runs/");
      const list = data || [];
      setRuns(list);

      const stored = (() => { try { return localStorage.getItem(LAST_RUN_KEY) || ""; } catch { return ""; }})();
      const fallback = list?.[0]?.id ? String(list[0].id) : "";
      const desired = preferId || stored;
      const sel = desired && list.some(r => String(r.id) === String(desired)) ? desired : fallback;

      setSelectedRunId(sel);
      const runObj = list.find(r => String(r.id) === String(sel)) || null;
      setSelectedRun(runObj);
      if (sel) {
        try { localStorage.setItem(LAST_RUN_KEY, sel); } catch {}
        await loadTrades(sel);
      } else {
        setTrades([]);
      }
    }catch(e){ console.error("Failed to load runs", e); }
  }

  async function loadTrades(runId){
    setLoading(true);
    try{
      const {data} = await api.get(`/api/journal/backtests/trades/?run=${encodeURIComponent(runId)}`);
      setTrades(data||[]);
    }catch(e){ console.error("Failed to load trades", e); setTrades([]); }
    finally{ setLoading(false); }
  }

  async function createRun(){
    const name = prompt("Run name?");
    if(!name) return;
    try{
      const {data: run} = await api.post("/api/journal/backtests/runs/", { name });
      setRuns(prev => [run, ...prev]);
      const sel = String(run.id);
      setSelectedRunId(sel);
      setSelectedRun(run);
      try { localStorage.setItem(LAST_RUN_KEY, sel); } catch {}
      await loadTrades(sel);
      flash("ok","Run created");
    }catch(e){
      console.error(e);
      alert("Failed to create run.");
    }
  }

  async function renameRun(id) {
    const r = runs.find(x => String(x.id) === String(id));
    const name = prompt("Rename run:", r?.name || "");
    if (!name) return;
    try {
      await api.patch(`/api/journal/backtests/runs/${id}/`, { name });
      await loadRuns(String(id));
      flash("ok","Run renamed");
    } catch(e) {
      console.error(e);
      alert("Rename failed.");
    }
  }

  async function deleteRun(id){
    if (!window.confirm("Delete this run and ALL its trades?")) return;
    try {
      await api.delete(`/api/journal/backtests/runs/${id}/`);
      const next = runs.filter(x=>String(x.id)!==String(id));
      setRuns(next);
      const sel = next[0]?.id ? String(next[0].id) : "";
      setSelectedRunId(sel);
      setSelectedRun(next.find(x=>String(x.id)===sel) || null);
      try { localStorage.setItem(LAST_RUN_KEY, sel); } catch {}
      if (sel) await loadTrades(sel); else setTrades([]);
      flash("ok","Run deleted");
    } catch(e) {
      console.error(e);
      alert("Delete run failed.");
    }
  }

  // P&L preview (pips × lots × pipVal – fee) or price deltas if available
  const previewPnL = useMemo(()=>{
    const pipVal = selectedRun?.fx_pip_value_per_standard_lot;
    const lots   = numOrNull(form.size_lots);
    const pips   = numOrNull(form.pips);
    const fee    = numOrNull(form.fee)||0;

    if (pips!=null && lots!=null && pipVal!=null) {
      return pips * lots * Number(pipVal) - fee;
    }
    const e = numOrNull(form.entry_price), x = numOrNull(form.exit_price);
    if (e!=null && x!=null && lots!=null) {
      const gross = form.direction==="short" ? (e-x)*lots : (x-e)*lots;
      return gross - fee;
    }
    return null;
  }, [form, selectedRun]);

  async function addTrade(e){
    e.preventDefault();
    if(!selectedRunId){ alert("Create/select a run first."); return; }

    try{
      const noteBits = [];
      if (form.strategy) noteBits.push(`STRATEGY: ${form.strategy}`);
      if (form.pips !== "") noteBits.push(`PIPS: ${form.pips}`);
      if (form.notes) noteBits.push(form.notes);

      const hh = ampmTo24(form.trade_hour, form.trade_ampm);
      const trade_time = `${String(hh).padStart(2,"0")}:00:00`;

      const payload = {
        run: Number(selectedRunId),
        date: form.date || new Date().toISOString().slice(0,10),
        trade_time,
        symbol: (form.symbol||"").toUpperCase().trim(),
        direction: form.direction,
        size: numOrNull(form.size_lots),
        fee: numOrNull(form.fee)||0,
        entry_price: numOrNull(form.entry_price),
        exit_price: numOrNull(form.exit_price),
        notes: noteBits.join(" | "),
        manual_outcome: form.outcome === "" ? null : (form.outcome === "win"),
      };

      const missing = [];
      if(!payload.symbol) missing.push("Symbol");
      if(payload.size==null) missing.push("Size (lots)");
      if(form.outcome === "" && form.pips==="" && (payload.entry_price==null || payload.exit_price==null))
        missing.push("Outcome or Pips or Entry+Exit");
      if(missing.length){ alert(`Missing: ${missing.join(", ")}`); return; }

      await api.post("/api/journal/backtests/trades/", payload, { headers: {"Content-Type":"application/json"}});
      await loadTrades(selectedRunId);
      setForm({
        date:"", trade_hour:"9", trade_ampm:"AM", symbol:"", direction:"long",
        pips:"", size_lots:"", fee:"", entry_price:"", exit_price:"", strategy:"", notes:"", outcome:"",
      });
      flash("ok","Trade saved");
    }catch(e){
      console.error(e);
      alert("Failed to add trade.");
    }
  }

  async function deleteTrade(id){
    if(!window.confirm("Delete trade?")) return;
    try{
      await api.delete(`/api/journal/backtests/trades/${id}/`);
      await loadTrades(selectedRunId);
    }catch(e){ alert("Delete failed"); }
  }

  // Single attachment (backend field: attachment)
  async function uploadPhoto(tradeId, file){
    if(!file) return;
    const fd = new FormData();
    fd.append("attachment", file);
    try{
      await api.patch(`/api/journal/backtests/trades/${tradeId}/`, fd, {
        headers: { "Content-Type":"multipart/form-data" },
      });
      await loadTrades(selectedRunId);
    }catch(e){ console.error(e); alert("Upload failed"); }
  }

  /* ---------- CSV Upload / Preview / Import ---------- */
  function onCsvSelected(file){
    if (!file) return;
    setCsvFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setCsvPreviewRows(res.data || []),
      error: (err) => { console.error("CSV parse error", err); setCsvPreviewRows(null); },
    });
  }

  async function importCsvIntoRun(runId){
    if (!csvFile) { alert("Pick a CSV first."); return; }
    setImporting(true);
    try{
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("run_id", String(runId));
      await api.post("/api/journal/backtests/import_csv/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadTrades(runId);
      setCsvPreviewRows(null);
      setCsvFile(null);
      flash("ok","CSV imported");
    }catch(e){
      console.error(e);
      alert("Import failed. Check CSV columns.");
    }finally{
      setImporting(false);
    }
  }

  async function createRunFromCsv(){
    if (!csvFile) { alert("Pick a CSV first."); return; }
    const name = prompt("Name for the new run:", csvFile.name.replace(/\.[^/.]+$/, ""));
    if (!name) return;
    try{
      const {data: run} = await api.post("/api/journal/backtests/runs/", { name });
      await importCsvIntoRun(run.id);
      await loadRuns(String(run.id));
    }catch(e){
      console.error(e);
      alert("Could not create run from CSV.");
    }
  }

  function downloadCsvTemplate(){
    const blob = new Blob([CSV_TEMPLATE], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qe-backtest-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // simple stats (now using is_win)
  const stats = useMemo(()=>{
    const rows = trades||[];
    const totals = rows.reduce((a,t)=>{
      const win = t.is_win;
      if (win === true) a.wins++;
      else if (win === false) a.losses++;
      const pnl = Number(t.net_pnl ?? 0);
      a.net += pnl;
      return a;
    },{net:0,wins:0,losses:0});
    const totalTrades = rows.length;
    const winRate = totalTrades ? (totals.wins/totalTrades*100) : 0;

    // pie by symbol (count)
    const counts = {};
    rows.forEach(t=>{ const s=(t.symbol||"—").toUpperCase(); counts[s]=(counts[s]||0)+1; });
    const pie = Object.entries(counts).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,12);

    // hours: keep winRate and trades counts (using is_win)
    const buckets = Array.from({length:24},(_,h)=>({hour:h,trades:0,wins:0}));
    rows.forEach(t=>{
      if(!t.trade_time) return;
      const hh = Number(String(t.trade_time).split(":")[0]); if(!(hh>=0&&hh<=23)) return;
      buckets[hh].trades += 1;
      if (t.is_win === true) buckets[hh].wins += 1;
    });
    const hourData = buckets.map(b=>({
      hour:b.hour,
      winRate: b.trades ? (b.wins/b.trades*100) : 0,
      trades: b.trades
    }));
    return { totals, winRate, pie, hourData };
  }, [trades]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Backtesting</h1>
          <div className="text-xs" style={{color:"var(--qe-muted)"}}>
            trades: {trades.length} • wins: {stats.totals.wins} • losses: {stats.totals.losses} • win rate: {stats.winRate.toFixed(1)}%
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="px-3 py-2 rounded-lg text-white text-sm" style={{background:"#4f46e5"}} onClick={createRun}>New Run</button>
          <select
            className="qe-select text-sm"
            value={selectedRunId}
            onChange={async (e) => {
              const sel = e.target.value;
              setSelectedRunId(sel);
              const r = runs.find(x => String(x.id) === sel) || null;
              setSelectedRun(r);
              try { localStorage.setItem(LAST_RUN_KEY, sel); } catch {}
              if (sel) await loadTrades(sel); else setTrades([]);
            }}
          >
            {(runs||[]).map(r=> <option key={r.id} value={r.id}>{r.name || `Run ${r.id}`}</option>)}
            {(!runs||runs.length===0) && <option value="">No runs</option>}
          </select>
          <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:"#263245"}} onClick={()=>setShowRunMgr(true)}>Manage Runs</button>

          <label className="px-3 py-2 rounded-lg border text-sm cursor-pointer" style={{borderColor:"#263245"}}>
            Upload CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e)=>onCsvSelected(e.target.files?.[0])}/>
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

      {/* CSV Preview box */}
      {csvPreviewRows && (
        <div className="rounded-xl border p-3 md:p-4" style={{borderColor:"#263245"}}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">CSV Preview (first {Math.min(200, csvPreviewRows.length)} rows)</div>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-lg text-white text-sm" style={{background:"#4f46e5"}} disabled={importing} onClick={()=>importCsvIntoRun(selectedRunId)}>{importing?"Importing…":"Import to Selected Run"}</button>
              <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:"#263245"}} onClick={createRunFromCsv}>Create New Run & Import</button>
              <button className="px-3 py-2 rounded-lg border text-sm" style={{borderColor:"#263245"}} onClick={()=>{ setCsvPreviewRows(null); setCsvFile(null); }}>Discard</button>
            </div>
          </div>
          <CsvPreviewTable rows={csvPreviewRows}/>
          <div className="text-xs mt-3" style={{color:"var(--qe-muted)"}}>
            Accepted headers (any of these variants are OK):<br/>
            <strong>Symbol</strong>/<strong>Ticker</strong>, <strong>Type</strong>/<strong>Side</strong>/<strong>Direction</strong>,
            <strong> Entry</strong>/<strong>Open Time</strong>, <strong>Exit</strong>/<strong>Close Time</strong>,
            <strong> Entry Price</strong>/<strong>Open Price</strong>, <strong>Exit Price</strong>/<strong>Close Price</strong>,
            <strong> Lot</strong>/<strong>Lots</strong>/<strong>Size</strong>/<strong>Qty</strong>,
            <strong> Commission</strong>/<strong>Fee</strong>, <strong>TP</strong>, <strong>SL</strong>, <strong>P&amp;L</strong> …<br/>
            (You can also copy our template and tweak your file.)
            <button className="ml-2 underline text-xs" onClick={downloadCsvTemplate}>Download CSV Template</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="# Trades" value={trades.length}/>
        <KPI label="Wins" value={stats.totals.wins}/>
        <KPI label="Losses" value={stats.totals.losses}/>
        <KPI label="Net P&L" value={money(stats.totals.net)}/>
      </div>

      {/* Add Trade */}
      <div className="rounded-xl border p-3 md:p-4" style={{borderColor:"#263245"}}>
        <div className="font-medium mb-3">Add Trade</div>
        <form onSubmit={addTrade} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input label="Date" type="date" value={form.date} onChange={(v)=>setForm(f=>({...f,date:v}))}/>
          <Select label="Hour" value={form.trade_hour} onChange={(v)=>setForm(f=>({...f,trade_hour:v}))}
            options={[...Array(12)].map((_,i)=>({label:String(i+1), value:String(i+1)}))}/>
          <Select label="AM/PM" value={form.trade_ampm} onChange={(v)=>setForm(f=>({...f,trade_ampm:v}))}
            options={[{label:"AM",value:"AM"},{label:"PM",value:"PM"}]}/>
          <Input label="Symbol" value={form.symbol} onChange={(v)=>setForm(f=>({...f,symbol:v}))} placeholder="AAPL / EURUSD"/>

          <Select label="Side" value={form.direction} onChange={(v)=>setForm(f=>({...f,direction:v}))}
                  options={[{label:"Long",value:"long"},{label:"Short",value:"short"}]}/>
          <Input label="Pips (±)" value={form.pips} onChange={(v)=>setForm(f=>({...f,pips:v}))} placeholder="e.g. 60"/>
          <Input label="Size (lots)" value={form.size_lots} onChange={(v)=>setForm(f=>({...f,size_lots:v}))} placeholder="e.g. 0.01"/>
          <Input label="Fee" value={form.fee} onChange={(v)=>setForm(f=>({...f,fee:v}))} placeholder="0"/>

          <Input label="Entry (optional)" value={form.entry_price} onChange={(v)=>setForm(f=>({...f,entry_price:v}))}/>
          <Input label="Exit (optional)" value={form.exit_price} onChange={(v)=>setForm(f=>({...f,exit_price:v}))}/>

          {/* Outcome (Win / Loss / Not set) */}
          <Select
            label="Outcome"
            value={form.outcome}
            onChange={(v)=>setForm(f=>({...f,outcome:v}))}
            options={[
              {label:"Not set (auto)", value:""},
              {label:"Win", value:"win"},
              {label:"Loss", value:"loss"},
            ]}
          />

          <Input label="Strategy" value={form.strategy} onChange={(v)=>setForm(f=>({...f,strategy:v}))} placeholder="Breakout A" className="md:col-span-3"/>

          <div className="md:col-span-4">
            <label className="text-xs" style={{color:"var(--qe-muted)"}}>Notes</label>
            <textarea className="qe-field mt-1" rows={2}
              value={form.notes} onChange={(e)=>setForm(f=>({...f,notes:e.target.value}))}/>
          </div>

          <div className="md:col-span-4 text-sm" style={{color:"var(--qe-muted)"}}>
            P&L preview: <strong style={{color:"#e5edf7"}}>{previewPnL==null ? "—" : money(previewPnL)}</strong>
            {selectedRun?.fx_pip_value_per_standard_lot!=null && (
              <span className="ml-2 text-xs">
                (pip $/1 lot: {selectedRun.fx_pip_value_per_standard_lot})
              </span>
            )}
          </div>

          <div className="md:col-span-4">
            <button className="px-4 py-2 rounded-lg text-white" style={{background:"#4f46e5"}} type="submit">Add Trade</button>
          </div>
        </form>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-3" style={{borderColor:"#263245"}}>
          <div className="text-sm mb-2" style={{color:"var(--qe-muted)"}}>Top Symbols (by trades)</div>
          <div style={{height:260}}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.pie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={95} paddingAngle={2}>
                  {stats.pie.map((_,i)=><Cell key={i} stroke="#0b1220" strokeWidth={1}/>)}
                </Pie>
                <ReTooltip contentStyle={{ borderRadius:12, background:"#0b1220", border:"1px solid #263245", color:"#e5edf7" }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dual-axis bar chart (Win% + #Trades) with performance colors */}
        <div className="rounded-xl border p-3 md:col-span-2" style={{borderColor:"#263245"}}>
          <div className="text-sm mb-2" style={{color:"var(--qe-muted)"}}>Win Rate & Trades by Hour</div>
          <div style={{height:260}}>
            <ResponsiveContainer>
              <BarChart data={stats.hourData}>
                <CartesianGrid stroke="#263245" strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(h)=>String(h).padStart(2,"0")} stroke="var(--qe-muted)" />
                <YAxis yAxisId="left" domain={[0,100]} tickFormatter={(v)=>`${v}%`} stroke="var(--qe-muted)" />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} stroke="var(--qe-muted)" />
                <Legend wrapperStyle={{ color: "var(--qe-muted)" }} />
                <ReTooltip
                  contentStyle={{ borderRadius: 12, background: "#0b1220", border: "1px solid #263245", color: "#e5edf7" }}
                  formatter={(value, name) => {
                    if (name === "Win %") return [`${value?.toFixed?.(0) ?? value}%`, "Win %"];
                    if (name === "Trades") return [value, "Trades"];
                    return [value, name];
                  }}
                  labelFormatter={(h)=>`Hour ${String(h).padStart(2,"0")}:00`}
                />
                <Bar name="Win %" dataKey="winRate" yAxisId="left">
                  {stats.hourData.map((d,i)=>(
                    <Cell key={i} fill={winRateColor(d.winRate)} />
                  ))}
                </Bar>
                <Bar name="Trades" dataKey="trades" yAxisId="right" fill="#64748b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Trades table */}
      <div className="rounded-xl border p-3 md:p-4" style={{borderColor:"#263245"}}>
        <div className="font-medium mb-2">Trades {selectedRunId && `(Run ${selectedRunId})`}</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{borderColor:"#263245"}}>
                <Th>Date</Th><Th>Time</Th><Th>Symbol</Th><Th>Side</Th>
                <Th>Outcome</Th><Th>Lots</Th><Th>Fee</Th><Th>P&L</Th><Th>Strategy</Th><Th>Notes</Th><Th>Photo</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {(trades||[]).map(t=>{
                const strat = (t.notes||"").match(/STRATEGY:\s*([^|]+)/i)?.[1]?.trim() || "";
                const outcomeBadge = t.is_win == null ? "—" : (t.is_win ? "WIN" : "LOSS");
                const outcomeColor = t.is_win == null ? "#94a3b8" : (t.is_win ? "#16a34a" : "#ef4444");
                return (
                  <tr key={t.id} className="border-b align-top" style={{borderColor:"#263245"}}>
                    <Td>{t.date ? new Date(`${t.date}T00:00:00`).toLocaleDateString() : "—"}</Td>
                    <Td>{t.trade_time ? String(t.trade_time).slice(0,5) : "—"}</Td>
                    <Td>{t.symbol}</Td>
                    <Td>{String(t.direction||"").toUpperCase()}</Td>
                    <Td><span className="px-2 py-0.5 rounded-md text-xs" style={{color: outcomeColor, border:`1px solid ${outcomeColor}66`}}>{outcomeBadge}</span></Td>
                    <Td>{t.size ?? "—"}</Td>
                    <Td>{money(t.fee)}</Td>
                    <Td style={{color:(t.net_pnl??0)>=0?"#16a34a":"#ef4444"}}>{money(t.net_pnl ?? 0)}</Td>
                    <Td>{strat || "—"}</Td>
                    <Td className="max-w-[260px] truncate" title={t.notes||""}>{t.notes||"—"}</Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs px-2 py-1 rounded-lg border cursor-pointer inline-block" style={{borderColor:"#263245"}}>
                          Upload Photo
                          <input type="file" className="hidden" accept="image/*,application/pdf"
                                 onChange={(e)=>uploadPhoto(t.id, e.target.files?.[0])}/>
                        </label>
                        {t.attachment
                          ? <a className="text-xs underline" href={t.attachment} target="_blank" rel="noreferrer">view</a>
                          : <span className="text-xs" style={{color:"var(--qe-muted)"}}>—</span>}
                      </div>
                    </Td>
                    <Td>
                      <button className="px-2 py-1 text-xs rounded-lg border" style={{borderColor:"#263245"}} onClick={()=>deleteTrade(t.id)}>Delete</button>
                    </Td>
                  </tr>
                );
              })}
              {(!trades || trades.length===0) && (
                <tr><td className="py-4" style={{color:"var(--qe-muted)"}} colSpan={12}>{loading?"Loading…":"No trades yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Run Manager modal */}
      {showRunMgr && (
        <RunManager
          runs={runs}
          selectedRunId={selectedRunId}
          onClose={()=>setShowRunMgr(false)}
          onSelect={async (id)=>{ setSelectedRunId(String(id)); try{localStorage.setItem(LAST_RUN_KEY,String(id));}catch{} await loadRuns(String(id)); }}
          onRename={renameRun}
          onDelete={deleteRun}
        />
      )}
    </div>
  );
}

/* ---------- tiny UI bits ---------- */
function KPI({label, value}){
  return (
    <div className="rounded-xl border p-3" style={{borderColor:"#263245"}}>
      <div className="text-xs" style={{color:"var(--qe-muted)"}}>{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
function Th({children}){ return <th className="py-2 pr-4 text-xs font-semibold" style={{color:"var(--qe-muted)"}}>{children}</th>; }
function Td({children, className=""}){ return <td className={`py-2 pr-4 ${className}`}>{children}</td>; }

function Input({label, value, onChange, type="text", placeholder, className=""}){
  return (
    <div className={className}>
      <label className="text-xs" style={{color:"var(--qe-muted)"}}>{label}</label>
      <input className="qe-field mt-1" type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}/>
    </div>
  );
}
function Select({label, value, onChange, options, className=""}){
  return (
    <div className={className}>
      <label className="text-xs" style={{color:"var(--qe-muted)"}}>{label}</label>
      <select className="qe-select mt-1" value={value} onChange={(e)=>onChange(e.target.value)}>
        {options.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function CsvPreviewTable({ rows }){
  if (!rows?.length) return <div className="text-xs" style={{color:"var(--qe-muted)"}}>Empty</div>;
  const headers = Object.keys(rows[0] || {});
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b" style={{borderColor:"#263245"}}>
            {headers.map((h) => (<th key={h} className="py-2 pr-4 text-xs" style={{color:"var(--qe-muted)"}}>{h}</th>))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0,200).map((row,i)=>(
            <tr key={i} className="border-b" style={{borderColor:"#263245"}}>
              {headers.map(h=>(
                <td key={h} className="py-2 pr-4 whitespace-nowrap">{String(row[h] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length>200 && <div className="text-xs mt-2" style={{color:"var(--qe-muted)"}}>Showing first 200 rows…</div>}
    </div>
  );
}

/* ---------- Run Manager ---------- */
function RunManager({ runs, selectedRunId, onClose, onSelect, onRename, onDelete }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{background:"rgba(0,0,0,.45)", zIndex:60}}>
      <div className="w-[680px] max-w-[92vw] rounded-2xl border p-4 bg-[#0b1220]" style={{borderColor:"#263245"}}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Manage Runs</div>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>
        <div className="text-xs mb-2" style={{color:"var(--qe-muted)"}}>
          Select a run to work on, rename it, or delete it. You can also create a new run from the page header.
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{borderColor:"#263245"}}>
                <th className="py-2 pr-4 text-xs" style={{color:"var(--qe-muted)"}}>Active</th>
                <th className="py-2 pr-4 text-xs" style={{color:"var(--qe-muted)"}}>Name</th>
                <th className="py-2 pr-4 text-xs" style={{color:"var(--qe-muted)"}}>Started</th>
                <th className="py-2 pr-4 text-xs" style={{color:"var(--qe-muted)"}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(runs||[]).map(r=>(
                <tr key={r.id} className="border-b" style={{borderColor:"#263245"}}>
                  <td className="py-2 pr-4">{String(r.id)===String(selectedRunId) ? "●" : ""}</td>
                  <td className="py-2 pr-4">{r.name || `Run ${r.id}`}</td>
                  <td className="py-2 pr-4">{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</td>
                  <td className="py-2 pr-4">
                    <button className="px-2 py-1 text-xs rounded-lg border mr-2" style={{borderColor:"#263245"}} onClick={()=>onSelect(r.id)}>Open</button>
                    <button className="px-2 py-1 text-xs rounded-lg border mr-2" style={{borderColor:"#263245"}} onClick={()=>onRename(r.id)}>Rename</button>
                    <button className="px-2 py-1 text-xs rounded-lg border" style={{borderColor:"#ef444455", color:"#ef4444"}} onClick={()=>onDelete(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {(!runs || runs.length===0) && (
                <tr><td className="py-3" style={{color:"var(--qe-muted)"}} colSpan={4}>No runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
