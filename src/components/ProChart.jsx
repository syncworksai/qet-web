// src/components/ProChart.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { useRealtimeFeed } from "../hooks/useRealtimeFeed";

// tiny indicator helpers here to avoid import mismatches
function sma(arr, p) {
  const out = new Array(arr.length).fill(null);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]; if (!Number.isFinite(v)) { out[i] = null; continue; }
    sum += v; if (i >= p) sum -= arr[i - p];
    if (i >= p - 1) out[i] = +(sum / p).toFixed(6);
  }
  return out;
}
function ema(arr, p) {
  const out = new Array(arr.length).fill(null);
  const k = 2 / (p + 1);
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]; if (!Number.isFinite(v)) continue;
    if (prev == null) {
      if (i >= p - 1) {
        const start = arr.slice(i - (p - 1), i + 1).filter(Number.isFinite);
        if (start.length === p) {
          prev = start.reduce((a,b)=>a+b,0) / p;
          out[i] = +prev.toFixed(6);
        }
      }
    } else {
      prev = prev + k * (v - prev);
      out[i] = +prev.toFixed(6);
    }
  }
  return out;
}
function atrHLC(h, l, c, p) {
  const trs = h.map((_, i) => {
    const hh = h[i], ll = l[i], cc = c[i], pc = c[i - 1];
    const tr = Math.max(hh - ll, Math.abs(hh - (pc ?? cc)), Math.abs(ll - (pc ?? cc)));
    return Number.isFinite(tr) ? tr : null;
  });
  return sma(trs, p);
}

const THEME = {
  bg: "#0b0f17",
  grid: "#16202c",
  text: "#c9d5e2",
  axis: "#1b2a3a",
  up: "#16a34a",
  down: "#ef4444",
  ema: "#60a5fa",
  sma: "#f472b6",
  volUp: "rgba(22,163,74,0.6)",
  volDn: "rgba(239,68,68,0.6)",
  atr: "#f59e0b",
};

function toTf(seconds) {
  const map = { 60: "1m", 300: "5m", 600: "10m", 900: "15m", 1800: "30m", 3600: "1h", 14400: "4h", 86400: "1D" };
  return map[seconds] || "1h";
}

export default function ProChart({ symbol, interval = 3600, height = 420, tight = false }) {
  const tf = toTf(interval);
  const { candles = [], status, reason } = useRealtimeFeed(symbol, tf, {
    maxBars: tight ? 200 : 500,
    pollMs: 25_000,
    jitterMs: 1200,
  });

  const ref = useRef(null);
  const priceRef = useRef(null);
  const volRef = useRef(null);
  const emaRef = useRef(null);
  const smaRef = useRef(null);
  const atrRef = useRef(null);

  const calc = useMemo(() => {
    const rows = Array.isArray(candles) ? candles : [];
    const close = rows.map(c => c?.close ?? NaN);
    const high  = rows.map(c => c?.high  ?? NaN);
    const low   = rows.map(c => c?.low   ?? NaN);
    const vol   = rows.map(c => c?.volume ?? 0);

    const e9  = ema(close, 9);
    const s9  = sma(close, 9);
    const a14 = atrHLC(high, low, close, 14);

    const hist = rows.map((c, i) => ({
      time: c.time,
      value: vol[i] ?? 0,
      color: i > 0
        ? ((close[i] ?? 0) >= (close[i - 1] ?? 0) ? THEME.volUp : THEME.volDn)
        : ((c.close ?? 0) >= (c.open ?? 0) ? THEME.volUp : THEME.volDn),
    }));
    return { e9, s9, a14, hist, rows };
  }, [candles]);

  // init chart
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { color: THEME.bg }, textColor: THEME.text },
      rightPriceScale: { borderColor: THEME.axis },
      timeScale: { borderColor: THEME.axis, timeVisible: tf !== "1D", secondsVisible: false },
      grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      autoSize: true,
    });

    const price = chart.addCandlestickSeries({
      upColor: THEME.up, downColor: THEME.down,
      wickUpColor: THEME.up, wickDownColor: THEME.down, borderVisible: false,
    });
    priceRef.current = price;

    const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "", overlay: true });
    volRef.current = vol;

    const e = chart.addLineSeries({ color: THEME.ema, lineWidth: 2, title: "EMA(9)" });
    const s = chart.addLineSeries({ color: THEME.sma, lineWidth: 2, title: "SMA(9)" });
    emaRef.current = e; smaRef.current = s;

    if (!tight) {
      const a = chart.addLineSeries({ color: THEME.atr, lineWidth: 2, priceScaleId: "left", title: "ATR(14)" });
      a.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0.05 } });
      atrRef.current = a;
    }

    const ro = new ResizeObserver(() => chart.applyOptions({ autoSize: true }));
    ro.observe(ref.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [tf, tight]);

  // push data
  useEffect(() => {
    if (!priceRef.current) return;
    priceRef.current.setData(
      (calc.rows || []).map(c => ({
        time:c.time,
        open:c.open, high:c.high, low:c.low, close:c.close
      }))
    );
  }, [calc.rows]);

  useEffect(() => { volRef.current?.setData(calc.hist || []); }, [calc.hist]);

  useEffect(() => {
    if (!emaRef.current) return;
    emaRef.current.setData(
      (calc.rows || []).map((c,i)=> calc.e9?.[i]==null ? null : ({ time:c.time, value:calc.e9[i] })).filter(Boolean)
    );
  }, [calc.rows, calc.e9]);

  useEffect(() => {
    if (!smaRef.current) return;
    smaRef.current.setData(
      (calc.rows || []).map((c,i)=> calc.s9?.[i]==null ? null : ({ time:c.time, value:calc.s9[i] })).filter(Boolean)
    );
  }, [calc.rows, calc.s9]);

  useEffect(() => {
    if (!atrRef.current) return;
    atrRef.current.setData(
      (calc.rows || []).map((c,i)=> calc.a14?.[i]==null ? null : ({ time:c.time, value:calc.a14[i] })).filter(Boolean)
    );
  }, [calc.rows, calc.a14]);

  const showOverlay = status === "error" || status === "closed";
  return (
    <div style={{ height, position:"relative" }}>
      <div className="rounded-xl overflow-hidden border border-white/10">
        <div ref={ref} style={{ height }} />
      </div>

      {showOverlay && (
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ paddingBottom: 8 }}>
          <div className="text-[11px] px-2 py-1 rounded bg-amber-500/10 border border-amber-400/30 text-amber-300">
            {reason === "auth" ? "Provider key/plan rejected for this symbol."
                               : "Feed temporarily unavailable (rate limit / network)."}
          </div>
        </div>
      )}
    </div>
  );
}
