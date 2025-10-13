// src/components/MultiPaneChart.jsx
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

/**
 * MultiPaneChart
 * Props:
 * - data: [{ time: '2024-10-01', open, high, low, close, volume }, ...]
 * - height: total height (px)
 * - panes: optional config if you want to customize later
 *
 * This component renders:
 *   Pane 0: Price (candles) + EMA(9) + EMA(21)
 *   Pane 1: Stochastic %K/%D with bands
 *   Pane 2: Momentum line (smoothed)
 *
 * All panes share the same time scale and crosshair.
 */

export default function MultiPaneChart({ data = [], height = 720 }) {
  const containerRef = useRef(null);
  const paneRefs = useRef([]);          // DOM nodes per pane
  const charts = useRef([]);            // LW charts per pane
  const series = useRef([]);            // series handles per pane
  const unsubscribers = useRef([]);     // cleanup listeners

  // --- simple helpers ---
  const ema = (arr, len, key = "close") => {
    const k = 2 / (len + 1);
    let prev;
    return arr.map((d, i) => {
      const v = d[key];
      if (i === 0) { prev = v; return { time: d.time, value: v }; }
      const e = v * k + prev * (1 - k);
      prev = e;
      return { time: d.time, value: e };
    });
  };

  const stoch = (arr, len = 14, smoothK = 3, smoothD = 3) => {
    const K = [];
    for (let i = 0; i < arr.length; i++) {
      const start = Math.max(0, i - len + 1);
      const win = arr.slice(start, i + 1);
      const ll = Math.min(...win.map(d => d.low));
      const hh = Math.max(...win.map(d => d.high));
      const k = hh === ll ? 50 : ((arr[i].close - ll) / (hh - ll)) * 100;
      K.push({ time: arr[i].time, value: k });
    }
    const smooth = (src, n) => src.map((d, i) => {
      const start = Math.max(0, i - n + 1);
      const win = src.slice(start, i + 1);
      const avg = win.reduce((s, x) => s + x.value, 0) / win.length;
      return { time: d.time, value: avg };
    });
    const Ksm = smooth(K, smoothK);
    const Dsm = smooth(Ksm, smoothD);
    return { K: Ksm, D: Dsm };
  };

  const momentum = (arr, lookback = 20) => {
    return arr.map((d, i) => {
      const j = i - lookback;
      const prev = j >= 0 ? arr[j].close : arr[0].close;
      return { time: d.time, value: (d.close - prev) };
    });
  };

  // --- layout: 3 panes (ratios similar to your screenshot) ---
  const paneHeights = [0.55, 0.27, 0.18].map(p => Math.round(p * height));

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Build pane containers
    containerRef.current.innerHTML = ""; // clear on re-mount
    paneRefs.current = [0, 1, 2].map(() => {
      const el = document.createElement("div");
      el.style.height = "0px";
      el.style.width = "100%";
      el.style.position = "relative";
      containerRef.current.appendChild(el);
      return el;
    });

    // Create charts
    charts.current = paneRefs.current.map((el, idx) => {
      return createChart(el, {
        height: paneHeights[idx],
        layout: { background: { color: "#0b1520" }, textColor: "#b9c2cf" },
        grid: { vertLines: { color: "#1a2633" }, horzLines: { color: "#1a2633" } },
        timeScale: { borderColor: "#1a2633" },
        rightPriceScale: { borderColor: "#1a2633" },
        crosshair: { mode: CrosshairMode.Normal },
      });
    });

    // ResizeObserver to keep charts fitting container
    const ro = new ResizeObserver(() => {
      const w = containerRef.current.clientWidth;
      charts.current.forEach((c, idx) => c.applyOptions({ width: w, height: paneHeights[idx] }));
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      charts.current.forEach(c => c.remove());
      charts.current = [];
      series.current = [];
      unsubscribers.current.forEach(f => f && f());
      unsubscribers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // --- data & series ---
  useEffect(() => {
    if (!charts.current.length || !data.length) return;

    // --------- Pane 0: Price + EMAs ----------
    const priceChart = charts.current[0];
    const candle = priceChart.addCandlestickSeries({
      upColor: "#2ecc71", downColor: "#e74c3c", borderUpColor: "#2ecc71",
      borderDownColor: "#e74c3c", wickUpColor: "#2ecc71", wickDownColor: "#e74c3c",
    });
    candle.setData(data.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));

    const ema9 = priceChart.addLineSeries({ lineWidth: 2 });
    const ema21 = priceChart.addLineSeries({ lineWidth: 2 });
    ema9.setData(ema(data, 9));
    ema21.setData(ema(data, 21));

    // --------- Pane 1: Stochastic ----------
    const oscChart = charts.current[1];
    const { K, D } = stoch(data, 14, 3, 3);
    const kSeries = oscChart.addLineSeries({ lineWidth: 2 });
    const dSeries = oscChart.addLineSeries({ lineWidth: 2 });
    kSeries.setData(K);
    dSeries.setData(D);

    // add bands (draw as horizontal lines)
    const band80 = oscChart.addLineSeries({ lineWidth: 1 });
    const band20 = oscChart.addLineSeries({ lineWidth: 1 });
    band80.setData(K.map(p => ({ time: p.time, value: 80 })));
    band20.setData(K.map(p => ({ time: p.time, value: 20 })));

    // --------- Pane 2: Momentum ----------
    const momChart = charts.current[2];
    const momSeries = momChart.addLineSeries({ lineWidth: 2 });
    momSeries.setData(momentum(data, 20));

    series.current = [
      { candle, ema9, ema21 },
      { kSeries, dSeries, band80, band20 },
      { momSeries },
    ];

    // Align visible range initially
    const mainScale = priceChart.timeScale().getVisibleRange();
    charts.current.slice(1).forEach(c => mainScale && c.timeScale().setVisibleRange(mainScale));

    // --- Synchronize crosshair + time scale ---
    // crosshair sync
    charts.current.forEach((src, i) => {
      const u = src.subscribeCrosshairMove(param => {
        if (!param.time) return;
        charts.current.forEach((dst, j) => {
          if (i === j) return;
          dst.setCrosshairPosition(param.point?.x, param.point?.y, param.pane);
        });
      });
      unsubscribers.current.push(() => src.unsubscribeCrosshairMove(u));
    });

    // timescale sync (zoom & scroll)
    const sync = (srcIdx) => {
      const range = charts.current[srcIdx].timeScale().getVisibleRange();
      charts.current.forEach((c, j) => { if (j !== srcIdx && range) c.timeScale().setVisibleRange(range); });
    };
    charts.current.forEach((c, idx) => {
      const u1 = c.timeScale().subscribeVisibleTimeRangeChange(() => sync(idx));
      unsubscribers.current.push(() => c.timeScale().unsubscribeVisibleTimeRangeChange(u1));
    });

    // nice price scales
    oscChart.priceScale("right").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
    momChart.priceScale("right").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });

    // fit content
    charts.current.forEach(c => c.timeScale().fitContent());
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: `${height}px`, display: "flex", flexDirection: "column", gap: "6px" }}
    />
  );
}
