// src/store/tradeStore.js
import { create } from "zustand";

/* --- simple valuation rules --- */
function specFor(symbol) {
  const s = String(symbol || "").toUpperCase();
  if (s === "XAUUSD" || s === "XAGUSD") {
    return { mode: "point", pointSize: 1, valuePerPoint: 1.0 }; // $1 per point
  }
  const jpy = /JPY$/.test(s);
  return { mode: "pip", pipSize: jpy ? 0.01 : 0.0001, valuePerPip: 0.01 }; // $0.01 per pip
}
function pnlFor(symbol, side, entry, exit) {
  const sp = specFor(symbol);
  const diff = side === "BUY" ? (exit - entry) : (entry - exit);
  if (sp.mode === "point") return (diff / sp.pointSize) * sp.valuePerPoint;
  return (diff / sp.pipSize) * sp.valuePerPip;
}

const LS_KEY = "qe_trades_v1";

export const useTradeStore = create((set, get) => ({
  trades: load(),

  place({ symbol, side, qty, price }) {
    const row = {
      id: crypto.randomUUID(),
      when: new Date().toISOString(),
      symbol: String(symbol || "").toUpperCase(),
      side: side === "SELL" ? "SELL" : "BUY",
      qty: Number(qty) || 0,
      entry: Number(price),
      exit: null,
      pnl: null,
      status: "OPEN",
    };
    const next = [...get().trades, row];
    save(next); set({ trades: next });
  },

  close(id, exitPrice) {
    const next = get().trades.map(t => {
      if (t.id !== id || t.status !== "OPEN") return t;
      const pnl = pnlFor(t.symbol, t.side, t.entry, Number(exitPrice));
      return { ...t, exit: Number(exitPrice), pnl: Number(pnl.toFixed(2)), status: "CLOSED" };
    });
    save(next); set({ trades: next });
  },

  exportCSV() {
    const rows = get().trades;
    if (!rows.length) return;
    const head = ["id","when","symbol","side","qty","entry","exit","pnl","status"];
    const body = rows.map(r => head.map(k => r[k] ?? "").join(","));
    const csv = [head.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "qe-paper-trades.csv"; a.click();
    URL.revokeObjectURL(url);
  },
}));

function load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function save(rows) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); } catch {}
}
