// src/lib/indicators.js

/* ---------- Moving Averages ---------- */
export function sma(values, period) {
  const n = Number(period) || 1;
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = Number(values[i]);
    if (!Number.isFinite(v)) continue;
    sum += v;
    if (i >= n) {
      const old = Number(values[i - n]);
      if (Number.isFinite(old)) sum -= old;
    }
    if (i >= n - 1) out[i] = +(sum / n).toFixed(8);
  }
  return out;
}

export function ema(values, period) {
  const n = Number(period) || 1;
  const out = new Array(values.length).fill(null);
  const k = 2 / (n + 1);
  let prev = null;

  for (let i = 0; i < values.length; i++) {
    const v = Number(values[i]);
    if (!Number.isFinite(v)) continue;

    if (prev == null) {
      // seed with SMA once we have 'period' samples
      if (i >= n - 1) {
        let s = 0, cnt = 0;
        for (let j = i - (n - 1); j <= i; j++) {
          const vv = Number(values[j]);
          if (Number.isFinite(vv)) { s += vv; cnt++; }
        }
        if (cnt === n) {
          prev = s / n;
          out[i] = +prev.toFixed(8);
        }
      }
    } else {
      prev = prev + k * (v - prev);
      out[i] = +prev.toFixed(8);
    }
  }
  return out;
}

/* ---------- ATR (two flavors) ---------- */
/**
 * ATR from separate H/L/C arrays (matches ProChart usage).
 */
export function atrHLC(highs, lows, closes, period = 14) {
  const len = Math.max(highs.length, lows.length, closes.length);
  const tr = new Array(len).fill(null);

  for (let i = 0; i < len; i++) {
    const h = Number(highs[i]);
    const l = Number(lows[i]);
    const cPrev = Number(closes[i - 1]);

    if (!Number.isFinite(h) || !Number.isFinite(l)) continue;

    if (!Number.isFinite(cPrev)) {
      tr[i] = h - l;
    } else {
      tr[i] = Math.max(
        h - l,
        Math.abs(h - cPrev),
        Math.abs(l - cPrev)
      );
    }
  }
  return sma(tr, period);
}

/**
 * ATR from an array of candle objects: {high, low, close}
 * Exported as 'atr' for convenience.
 */
export function atr(candles, period = 14) {
  const highs  = candles.map(c => c?.high);
  const lows   = candles.map(c => c?.low);
  const closes = candles.map(c => c?.close);
  return atrHLC(highs, lows, closes, period);
}
