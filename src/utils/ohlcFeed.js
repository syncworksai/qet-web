// src/utils/ohlcFeed.js
import { api } from "../api/axios";

/** Map human TF to seconds */
const TF_SEC = {
  M1: 60,
  M5: 300,
  M10: 600,
  M15: 900,
  M30: 1800,
  H1: 3600,
};

export function tfToSeconds(tf = "M5") {
  return TF_SEC[tf] || 300;
}

function toLW(rows) {
  // {t,o,h,l,c} arrays → [{time, open, high, low, close}]
  const out = [];
  const n = Math.min(
    rows.t?.length || 0,
    rows.o?.length || 0,
    rows.h?.length || 0,
    rows.l?.length || 0,
    rows.c?.length || 0
  );
  for (let i = 0; i < n; i++) {
    out.push({
      time: Number(rows.t[i]),
      open: Number(rows.o[i]),
      high: Number(rows.h[i]),
      low: Number(rows.l[i]),
      close: Number(rows.c[i]),
    });
  }
  return out;
}

export async function fetchOHLC(symbol, { tf = "M5", range = "7d" } = {}) {
  try {
    const interval = tfToSeconds(tf);
    const { data } = await api.get(`/market/ohlc/`, {
      params: { symbol, interval, range },
    });
    const rows = toLW(data || {});
    if (rows.length) return rows;
  } catch (e) {
    // swallow
  }
  // fallback demo (never throw)
  return generateDemoOHLC(symbol, 300, undefined, tfToSeconds(tf));
}

export function subscribeOHLC(symbol, { tf = "M5", everyMs = 5000, onBar }) {
  let die = false;
  const interval = tfToSeconds(tf);

  const tick = async () => {
    if (die) return;
    try {
      const { data } = await api.get(`/market/ohlc/latest/`, {
        params: { symbol, interval },
      });
      const bar = {
        time: Number(data?.t ?? Date.now() / 1000),
        open: Number(data?.o ?? 0),
        high: Number(data?.h ?? 0),
        low: Number(data?.l ?? 0),
        close: Number(data?.c ?? 0),
      };
      onBar?.(bar);
    } catch {
      // ignore
    } finally {
      if (!die) timer = setTimeout(tick, everyMs);
    }
  };

  let timer = setTimeout(tick, 10);
  return () => {
    die = true;
    if (timer) clearTimeout(timer);
  };
}

// ---------- Tiny demo generator (stable) ----------
export function generateDemoOHLC(symbol, points = 240, seed, stepSec = 60) {
  // deterministic-ish by symbol
  let s = seed ?? 0;
  for (const ch of String(symbol)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;

  const rnd = () => {
    s ^= (s << 13) >>> 0;
    s ^= (s >>> 17) >>> 0;
    s ^= (s << 5) >>> 0;
    return (s >>> 0) / 0xffffffff;
  };

  const base =
    /XAU/.test(symbol) ? 1900 : /BTC|ETH|USDT|USDC|XRP/.test(symbol) ? 30000 : 100;
  const out = [];
  const end = Math.floor(Date.now() / 1000);
  const start = end - points * stepSec;
  let price = base;

  for (let i = 0; i < points; i++) {
    const t = start + i * stepSec;
    const vol = 0.0025;
    const d = (rnd() - 0.5) * vol;
    const o = price;
    const c = Math.max(0.00001, o * (1 + d));
    const h = Math.max(o, c) * (1 + rnd() * vol * 0.6);
    const l = Math.min(o, c) * (1 - rnd() * vol * 0.6);
    out.push({ time: t, open: o, high: h, low: l, close: c });
    price = c;
  }
  return out;
}
