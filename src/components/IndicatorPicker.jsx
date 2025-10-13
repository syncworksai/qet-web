// src/components/IndicatorPicker.jsx
import React, { useMemo, useState } from "react";

const LIB = [
  { key: "ema", label: "EMA", where: "price", params: [{k:"len",d:9}] },
  { key: "sma", label: "SMA", where: "price", params: [{k:"len",d:20}] },
  { key: "bb", label: "Bollinger Bands", where: "price", params: [{k:"len",d:20},{k:"dev",d:2}] },
  { key: "vwap", label: "VWAP", where: "price", params: [] },
  { key: "rsi", label: "RSI", where: "pane", params: [{k:"len",d:14}] },
  { key: "stoch", label: "Stochastic", where: "pane", params: [{k:"len",d:14},{k:"k",d:3},{k:"d",d:3}] },
  { key: "macd", label: "MACD", where: "pane", params: [{k:"fast",d:12},{k:"slow",d:26},{k:"sig",d:9}] },
  { key: "mom", label: "Momentum", where: "pane", params: [{k:"len",d:20}] },
  { key: "atr", label: "ATR", where: "pane", params: [{k:"len",d:14}] },
  { key: "supertrend", label: "Supertrend", where: "price", params: [{k:"len",d:10},{k:"mult",d:3}] },
];

export default function IndicatorPicker({ open, onClose, onAdd }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return LIB;
    return LIB.filter(i => (i.label + " " + i.key).toLowerCase().includes(s));
  }, [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24 bg-black/40" onMouseDown={onClose}>
      <div className="w-[560px] rounded-2xl border border-white/15 bg-[#0b0f17] p-4 shadow-2xl"
           onMouseDown={(e)=>e.stopPropagation()}>
        <div className="text-sm font-semibold mb-3">Add Indicator</div>
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Search (e.g., RSI, MACD, Supertrend)"
          className="w-full bg-transparent border border-white/15 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <div className="max-h-80 overflow-auto space-y-1">
          {list.map(i => (
            <button
              key={i.key}
              onClick={()=>{ onAdd(i); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.06] border border-white/10"
            >
              <div className="text-left">
                <div className="text-sm">{i.label}</div>
                <div className="text-[11px] opacity-60 uppercase">{i.where === "price" ? "Overlay" : "Own pane"}</div>
              </div>
              <div className="text-[11px] opacity-60 font-mono">{i.key}</div>
            </button>
          ))}
          {!list.length && <div className="text-xs opacity-60 px-1 py-2">No results.</div>}
        </div>
        <div className="flex justify-end mt-3">
          <button className="px-3 py-2 text-sm rounded-lg border border-white/15 hover:bg-white/[0.06]" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
