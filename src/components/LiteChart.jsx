// src/components/LiteChart.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { fetchOHLC, generateDemoOHLC, subscribeOHLC } from "../utils/ohlcFeed";

function useTheme() {
  const [t, setT] = useState({
    bg: "#0b1220",
    grid: "#1f2937",
    text: "#cbd5e1",
    up: "#16a34a",
    down: "#ef4444",
  });
  useEffect(() => {
    const get = (name, fallback) => {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
      } catch { return fallback; }
    };
    setT({
      bg: get("--chart-bg", "#0b1220"),
      grid: get("--chart-grid", "#1f2937"),
      text: get("--chart-text", "#cbd5e1"),
      up: get("--chart-up", "#16a34a"),
      down: get("--chart-down", "#ef4444"),
    });
  }, []);
  return t;
}

export default function LiteChart({ active, interval = 60, range = "7d" }) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const priceRef = useRef(null);

  const theme = useTheme();
  const symbol = (active?.symbol || "AAPL").toUpperCase();
  const type = (active?.asset_type || "stock").toUpperCase();
  const title = useMemo(() => `${symbol} · ${type}`, [symbol, type]);

  // mount chart
  useEffect(() => {
    if (!wrapRef.current) return;
    const chart = createChart(wrapRef.current, {
      layout: { background: { color: theme.bg }, textColor: theme.text },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: theme.grid, rightOffset: 8, barSpacing: 6, lockVisibleTimeRangeOnResize: true },
      rightPriceScale: { borderColor: theme.grid },
      autoSize: true,
      handleScroll: true,
      handleScale: true,
    });
    const series = chart.addCandlestickSeries({
      upColor: theme.up, borderUpColor: theme.up, wickUpColor: theme.up,
      downColor: theme.down, borderDownColor: theme.down, wickDownColor: theme.down,
    });
    const priceLine = chart.addLineSeries({ color: theme.text, lineWidth: 1, priceLineVisible: false });
    chartRef.current = chart;
    candleRef.current = series;
    priceRef.current = priceLine;

    const ro = new ResizeObserver(() => chart.applyOptions({ autoSize: true }));
    ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      priceRef.current = null;
    };
  }, [theme.bg, theme.grid, theme.text, theme.up, theme.down]);

  // load initial + subscribe to live updates
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    let unsubscribe = null;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        let data = await fetchOHLC(symbol, { interval, range });
        if (!data || data.length < 5) {
          data = generateDemoOHLC(symbol, 240, undefined, interval); // fallback
          setErr("demo");
        }
        if (!alive || !candleRef.current || !priceRef.current) return;
        candleRef.current.setData(data);
        priceRef.current.setData(data.map((d) => ({ time: d.time, value: d.close })));
        chartRef.current?.timeScale().fitContent();

        // live updates (polling)
        unsubscribe = subscribeOHLC(symbol, {
          interval,
          everyMs: 5000,
          onBar: (bar) => {
            if (!candleRef.current || !priceRef.current) return;
            const last = data[data.length - 1];
            if (last && Number(last.time) === Number(bar.time)) {
              data[data.length - 1] = bar;        // update last bar
              candleRef.current.update(bar);
            } else if (!last || Number(bar.time) > Number(last.time)) {
              data.push(bar);                      // append new bar
              candleRef.current.update(bar);
            }
            priceRef.current.update({ time: bar.time, value: bar.close });
          },
        });
      } catch (e) {
        console.error("LiteChart load failed:", e);
        if (!alive) return;
        setErr("Failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (unsubscribe) unsubscribe();
    };
  }, [symbol, interval, range]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-neutral-300">
          <span className="font-medium text-white">{title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          {loading ? "Loading…" : err === "demo" ? "Demo live feed" : "Live feed"}
        </div>
      </div>
      <div
        ref={wrapRef}
        className="w-full h-[520px] rounded-lg overflow-hidden"
        style={{ background: "var(--background)" }}
      />
    </div>
  );
}
