// src/components/ChartColumn.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { CandleBuilder } from "../lib/candleBuilder";
import { atrFromCandles } from "../lib/indicators";
import { barCloseCountdown } from "../lib/timeframes";
import { tfSeconds } from "../lib/timeframes";
import { subscribeTicks } from "../feeds/FeedHub";

const THEME = {
  bg: "#0b0f17",
  grid: "#16202c",
  text: "#c9d5e2",
  axis: "#1b2a3a",
  up: "#16a34a",
  dn: "#ef4444",
  atr: "#f59e0b",
};

export default function ChartColumn({ symbol, timeframe }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const priceRef = useRef(null);
  const atrRef = useRef(null);

  const [countdown, setCountdown] = useState("--");
  const [atrVal, setAtrVal] = useState("--");

  useEffect(() => {
    const el = ref.current;
    const chart = createChart(el, {
      layout: { background: { color: THEME.bg }, textColor: THEME.text },
      grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
      rightPriceScale: { borderColor: THEME.axis },
      timeScale: { borderColor: THEME.axis, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Magnet },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, pinch: true, mouseWheel: true },
      autoSize: true,
    });
    const price = chart.addCandlestickSeries({
      upColor: THEME.up, downColor: THEME.dn, wickUpColor: THEME.up, wickDownColor: THEME.dn, borderVisible: false,
    });
    const atrPane = chart.addHistogramSeries({ priceScaleId: "", priceFormat: { type: "price", precision: 6 } });
    atrPane.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0.02 } });

    chartRef.current = chart; priceRef.current = price; atrRef.current = atrPane;

    const ro = new ResizeObserver(() => chart.applyOptions({ autoSize: true }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  useEffect(() => {
    if (!priceRef.current) return;
    const builder = CandleBuilder(timeframe);
    const tfSec = tfSeconds(timeframe);

    const unsub = subscribeTicks(symbol, (tick) => {
      const { bar, bars } = builder.feedTick(tick);

      // update price series
      priceRef.current.update({ time: bar.t, open: bar.open, high: bar.high, low: bar.low, close: bar.close });

      // recompute ATR(5) on last ~500 bars
      const src = [...bars, bar].slice(-500).map(b => ({
        time: b.t, open: b.open, high: b.high, low: b.low, close: b.close,
      }));
      const atrArr = atrFromCandles(src, 5);
      const lastAtr = atrArr[atrArr.length - 1];
      setAtrVal(lastAtr ? lastAtr.toFixed(5) : "--");
      atrRef.current.setData(src.map((b, i) => ({ time: b.time, value: atrArr[i] || 0 })));

      const now = Math.floor(Date.now() / 1000);
      setCountdown(fmtCountdown(barCloseCountdown(now, bar.t, tfSec)));
    });

    return () => unsub();
  }, [symbol, timeframe]);

  return (
    <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
      <Header symbol={symbol} timeframe={timeframe} countdown={countdown} atr={atrVal} />
      <div ref={ref} style={{ width: 330, height: 520 }} />
    </div>
  );
}

function Header({ symbol, timeframe, countdown, atr }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 10px", background: "#0c121b", borderBottom: "1px solid rgba(255,255,255,0.08)"
    }}>
      <div style={{ fontWeight: 700, letterSpacing: 0.3 }}>
        {symbol} <span style={{ opacity: .7 }}>{timeframe.toUpperCase()}</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Badge title="ATR (5)" value={atr} />
        <Badge title="" value={countdown} />
      </div>
    </div>
  );
}
function Badge({ title, value }) {
  return (
    <div style={{
      fontSize: 12, background: "#13202e", border: "1px solid #1e2b3a",
      padding: "2px 6px", borderRadius: 6, color: "#c9d5e2", minWidth: 54, textAlign: "center"
    }}>
      {title ? <span style={{ opacity: .8, marginRight: 4 }}>{title}:</span> : null}{value}
    </div>
  );
}
function fmtCountdown(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
