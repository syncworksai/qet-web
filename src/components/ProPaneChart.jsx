import React, { useEffect, useMemo, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { ema, sma, atr } from "../lib/indicators";
import { emit, on } from "../lib/syncBus";

const THEME = {
  bg: "#0b0f17", grid: "#16202c", text: "#c9d5e2", axis: "#1b2a3a",
  up: "#16a34a", down: "#ef4444", ema: "#60a5fa", sma: "#f472b6",
  volUp: "rgba(22,163,74,0.6)", volDn: "rgba(239,68,68,0.6)", atr: "#f59e0b",
};

export default function ProPaneChart({ id, candles, symbol, timeframe, showATR = true }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const priceRef = useRef(null);
  const volRef = useRef(null);
  const emaRef = useRef(null);
  const smaRef = useRef(null);
  const atrRef = useRef(null);

  const calc = useMemo(() => {
    const c = candles;
    const close = c.map(x=>x.close), high=c.map(x=>x.high), low=c.map(x=>x.low), vol=c.map(x=>x.volume);
    const e9 = ema(close, 9), s9 = sma(close, 9), a14 = atr(high, low, close, 14);
    const vols = c.map((k,i)=>({
      time:k.time, value: vol[i]??0,
      color: (i>0 ? close[i] >= close[i-1] : k.close>=k.open) ? THEME.volUp : THEME.volDn
    }));
    return { e9, s9, a14, vols };
  }, [candles]);

  useEffect(() => {
    if (!elRef.current) return;
    const chart = createChart(elRef.current, {
      layout: { background:{ color: THEME.bg }, textColor: THEME.text },
      rightPriceScale: { borderColor: THEME.axis },
      timeScale: { borderColor: THEME.axis, timeVisible: timeframe !== "1D" },
      grid: { vertLines:{ color: THEME.grid }, horzLines:{ color: THEME.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });
    chartRef.current = chart;

    const price = chart.addCandlestickSeries({
      upColor: THEME.up, downColor: THEME.down, borderVisible: false, wickUpColor: THEME.up, wickDownColor: THEME.down,
    });
    priceRef.current = price;

    const vol = chart.addHistogramSeries({ priceFormat:{ type:"volume" }, overlay:true, priceScaleId:"" });
    volRef.current = vol;

    const e = chart.addLineSeries({ color: THEME.ema, lineWidth: 2 });
    const s = chart.addLineSeries({ color: THEME.sma, lineWidth: 2 });
    emaRef.current = e; smaRef.current = s;

    if (showATR) {
      const atrS = chart.addLineSeries({ color: THEME.atr, lineWidth: 2, priceScaleId: "left", title: "ATR(14)" });
      atrRef.current = atrS;
      atrS.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0.05 } });
    }

    const offMove = chart.subscribeCrosshairMove(p => { if (p.time) emit("x-sync", { from:id, time:p.time }); });
    const offRange = chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const r = chart.timeScale().getVisibleRange(); if (r) emit("range-sync", { from:id, range:r });
    });
    const u1 = on("x-sync", ({ from, time }) => { if (from!==id && time) chart.moveCrosshair(time); });
    const u2 = on("range-sync", ({ from, range }) => { if (from!==id && range) chart.timeScale().setVisibleRange(range); });

    const ro = new ResizeObserver(() => chart.applyOptions({ autoSize: true }));
    ro.observe(elRef.current);

    return () => { offMove && chart.unsubscribeCrosshairMove(offMove);
      offRange && chart.timeScale().unsubscribeVisibleTimeRangeChange(offRange);
      u1(); u2(); ro.disconnect(); chart.remove(); };
  }, [id, timeframe, showATR]);

  useEffect(() => {
    if (!candles.length || !priceRef.current) return;
    priceRef.current.setData(candles.map(c=>({ time:c.time, open:c.open, high:c.high, low:c.low, close:c.close })));
  }, [candles]);

  useEffect(() => {
    if (!volRef.current) return;
    volRef.current.setData(calc.vols);
  }, [calc.vols]);

  useEffect(() => {
    if (!emaRef.current) return;
    emaRef.current.setData(candles.map((c,i)=>calc.e9[i]==null?null:{ time:c.time, value:calc.e9[i] }).filter(Boolean));
  }, [candles, calc.e9]);

  useEffect(() => {
    if (!smaRef.current) return;
    smaRef.current.setData(candles.map((c,i)=>calc.s9[i]==null?null:{ time:c.time, value:calc.s9[i] }).filter(Boolean));
  }, [candles, calc.s9]);

  useEffect(() => {
    if (!atrRef.current) return;
    atrRef.current.setData(candles.map((c,i)=>calc.a14[i]==null?null:{ time:c.time, value:calc.a14[i] }).filter(Boolean));
  }, [candles, calc.a14]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-3 py-2 text-xs bg-[#0c121b] border-b border-white/10 flex items-center gap-3">
        <span className="font-semibold">{symbol}</span>
        <span className="opacity-70">• {timeframe}</span>
      </div>
      <div ref={elRef} className="flex-1" />
    </div>
  );
}
