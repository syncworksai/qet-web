// src/feeds/index.js
import { publishTick } from "./FeedHub";

const BASE = "https://api.twelvedata.com";
const KEY  = import.meta.env.VITE_TWELVE_DATA_KEY || "";
const POLL_MS = Number(import.meta.env.VITE_QE_TWELVE_POLL_MS || 4000);

// Normalize app symbols -> TwelveData symbols (XAUUSD -> XAU/USD)
function toTD(symbol) {
  const s = String(symbol || "").toUpperCase();
  if (s.length === 6 && /^[A-Z]{6}$/.test(s)) return `${s.slice(0,3)}/${s.slice(3,6)}`;
  if (s === "US30") return "DJI"; // example index mapping if you add it later
  return s.replace("-", "/");
}

/**
 * Start polling Twelve Data /price for a set of symbols.
 * Emits: publishTick("XAUUSD", { price, ts })
 */
export function startFeedTwelveData(symbols = ["XAUUSD"]) {
  if (!KEY) {
    console.warn("[QE] Missing VITE_TWELVE_DATA_KEY – live polling disabled.");
    return () => {};
  }

  let stop = false;
  const tdSymbols = symbols.map(toTD).join(",");

  const tick = async () => {
    if (stop) return;
    try {
      const qs = new URLSearchParams({ symbol: tdSymbols, apikey: KEY });
      const res = await fetch(`${BASE}/price?${qs.toString()}`);
      if (!res.ok) throw new Error(`TD /price ${res.status}`);
      const data = await res.json();

      // Response can be array or object map
      const rows = Array.isArray(data) ? data : Object.values(data);

      const now = Math.floor(Date.now() / 1000);
      for (const r of rows) {
        const tdSym = r.symbol;         // e.g. "XAU/USD"
        const price = Number(r.price);  // string -> number
        if (!Number.isFinite(price)) continue;
        const appSym = tdSym.replace("/", ""); // "XAUUSD"
        publishTick(appSym, { price, ts: Number(r.timestamp) || now });
      }
    } catch (e) {
      // Swallow transient errors to keep UI live
    } finally {
      if (!stop) setTimeout(tick, POLL_MS);
    }
  };

  tick();
  return () => { stop = true; };
}
