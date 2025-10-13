// src/store/feedStore.js
import { create } from "zustand";

const BASE = "https://api.twelvedata.com";
const KEY  = import.meta.env.VITE_TWELVE_DATA_KEY || "";
const POLL_MS = 4000;

function norm(symbol) {
  const s = String(symbol || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (s.length === 6) return `${s.slice(0,3)}/${s.slice(3,6)}`;
  if (s === "XAUUSD") return "XAU/USD";
  if (s === "XAGUSD") return "XAG/USD";
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(symbol)) return symbol.toUpperCase();
  return symbol || "";
}

export const useFeedStore = create((set, get) => ({
  last: {},               // symbol -> { price, ts }
  running: false,
  symbols: new Set(),
  _timer: null,

  addSymbol(symbol) {
    const sym = norm(symbol);
    if (!sym) return;
    const next = new Set(get().symbols);
    next.add(sym);
    set({ symbols: next });
    if (!get().running) get().start();
  },

  removeSymbol(symbol) {
    const sym = norm(symbol);
    const next = new Set(get().symbols);
    next.delete(sym);
    set({ symbols: next });
  },

  start() {
    if (get()._timer || !KEY) return;
    const tick = async () => {
      const syms = Array.from(get().symbols);
      if (!syms.length) return;
      try {
        const qs = new URLSearchParams({ symbol: syms.join(","), apikey: KEY });
        const res = await fetch(`${BASE}/price?${qs.toString()}`);
        if (!res.ok) throw new Error(`price ${res.status}`);
        const data = await res.json();
        const obj = Array.isArray(data)
          ? Object.fromEntries(data.map(d => [d.symbol, d]))
          : data;

        set(s => {
          const next = { ...s.last };
          for (const sym of syms) {
            const p = Number(obj?.[sym]?.price);
            const ts = Number(obj?.[sym]?.timestamp) || Math.floor(Date.now()/1000);
            if (Number.isFinite(p)) next[sym] = { price: p, ts };
          }
          return { last: next };
        });
      } catch (e) {
        // ignore transient errors
      }
    };

    tick();
    const t = setInterval(tick, POLL_MS);
    set({ running: true, _timer: t });
  },

  stop() {
    const t = get()._timer;
    if (t) clearInterval(t);
    set({ _timer: null, running: false });
  },
}));
