// src/components/ToolableChart.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { fetchOHLC, generateDemoOHLC, subscribeOHLC } from "../utils/ohlcFeed";

export default function ToolableChart({
  symbol,
  interval = 60,
  range = "7d",
  height = 360,
  showEMA = true,
  showRSI = true,
  showMACD = false,
  showBB = false,
  showSTOCH = false,
}) {
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const priceLineRef = useRef(null);

  const emaSeriesRef = useRef(null);
  const bbMidRef = useRef(null);
  const bbUpperRef = useRef(null);
  const bbLowerRef = useRef(null);

  const rsiPaneRef = useRef(null);
  const rsiSeriesRef = useRef(null);
  const macdPaneRef = useRef(null);
  const macdSeriesRef = useRef(null);
  const macdSignalRef = useRef(null);
  const macdHistRef = useRef(null);
  const stochPaneRef = useRef(null);
  const stochKRef = useRef(null);
  const stochDRef = useRef(null);

  const overlayRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const theme = {
    bg: "#0b1220",
    grid: "#253142",
    gridBold: "#1f2937",
    text: "#cbd5e1",
    up: "#16a34a",
    down: "#ef4444",
    accent: "#60a5fa",
    gold: "#f59e0b",
    mint: "#34d399",
    rose: "#fb7185",
    purple: "#c084fc",
    cyan: "#22d3ee",
  };

  /* -------------------- Indicators -------------------- */
  const ema = (rows, n = 20) => {
    if (!rows.length) return [];
    const k = 2 / (n + 1);
    let p = rows[0].close;
    const out = rows.map((r, i) => {
      if (!i) return null;
      p = r.close * k + p * (1 - k);
      return { time: r.time, value: p };
    });
    return out.filter(Boolean);
  };
  const boll = (rows, n = 20, mult = 2) => {
    if (rows.length < n) return { mid: [], upper: [], lower: [] };
    let sum = 0,
      sumSq = 0;
    const mid = [],
      upper = [],
      lower = [];
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i].close;
      sum += c;
      sumSq += c * c;
      if (i >= n) {
        const old = rows[i - n].close;
        sum -= old;
        sumSq -= old * old;
      }
      if (i >= n - 1) {
        const mean = sum / n;
        const sd = Math.sqrt(Math.max(sumSq / n - mean * mean, 0));
        mid.push({ time: rows[i].time, value: mean });
        upper.push({ time: rows[i].time, value: mean + mult * sd });
        lower.push({ time: rows[i].time, value: mean - mult * sd });
      }
    }
    return { mid, upper, lower };
  };
  const rsi = (rows, n = 14) => {
    if (rows.length < n + 1) return [];
    const c = rows.map((r) => r.close);
    let g = 0,
      l = 0;
    for (let i = 1; i <= n; i++) {
      const d = c[i] - c[i - 1];
      g += Math.max(d, 0);
      l += Math.max(-d, 0);
    }
    let avgG = g / n,
      avgL = l / n;
    const out = Array(n).fill(null);
    for (let i = n + 1; i < c.length; i++) {
      const d = c[i] - c[i - 1];
      const G = Math.max(d, 0),
        L = Math.max(-d, 0);
      avgG = (avgG * (n - 1) + G) / n;
      avgL = (avgL * (n - 1) + L) / n;
      const rs = avgL === 0 ? 100 : avgG / avgL;
      out.push({ time: rows[i].time, value: 100 - 100 / (1 + rs) });
    }
    return out.filter(Boolean);
  };
  const macdCalc = (rows, fast = 12, slow = 26, sig = 9) => {
    if (!rows.length) return { macd: [], signal: [], hist: [] };
    const emaN = (n) => {
      const k = 2 / (n + 1);
      let p = rows[0].close;
      const out = rows
        .map((r, i) => {
          if (!i) return null;
          p = r.close * k + p * (1 - k);
          return { time: r.time, value: p };
        })
        .filter(Boolean);
      return out;
    };
    const fe = emaN(fast),
      se = emaN(slow),
      m = [];
    const min = Math.min(fe.length, se.length);
    for (let i = 0; i < min; i++) {
      const idx = rows.length - min + i;
      m.push({
        time: rows[idx].time,
        value: fe[fe.length - min + i].value - se[se.length - min + i].value,
      });
    }
    const k = 2 / (sig + 1);
    let p = m[0]?.value ?? 0;
    const s = m.map((x, i) => {
      if (!i) return { time: x.time, value: p };
      p = x.value * k + p * (1 - k);
      return { time: x.time, value: p };
    });
    const h = m.map((x, i) => ({ time: x.time, value: x.value - (s[i]?.value ?? 0) }));
    return { macd: m, signal: s, hist: h };
  };
  const stoch = (rows, kLen = 14, dLen = 3) => {
    if (rows.length < kLen) return { k: [], d: [] };
    const k = [];
    for (let i = kLen - 1; i < rows.length; i++) {
      const slice = rows.slice(i - kLen + 1, i + 1);
      const H = Math.max(...slice.map((s) => s.high));
      const L = Math.min(...slice.map((s) => s.low));
      const C = rows[i].close;
      const val = H === L ? 50 : ((C - L) / (H - L)) * 100;
      k.push({ time: rows[i].time, value: val });
    }
    const d = [];
    for (let i = dLen - 1; i < k.length; i++) {
      const sl = k.slice(i - dLen + 1, i + 1).map((p) => p.value);
      d.push({ time: k[i].time, value: sl.reduce((a, b) => a + b, 0) / dLen });
    }
    return { k, d };
  };

  /* ---------------- Drawing (tool state + persistence) ---------------- */
  const [tool, setTool] = useState("none"); // 'trendline' | 'hline' | 'fib'
  const [drawings, setDrawings] = useState(() => {
    try {
      const raw = localStorage.getItem(`qe_draw_${symbol}_${interval}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const partialRef = useRef(null); // first click point
  const cursorRef = useRef(null); // crosshair preview point

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`qe_draw_${symbol}_${interval}`);
      setDrawings(raw ? JSON.parse(raw) : []);
    } catch {
      setDrawings([]);
    }
    partialRef.current = null;
    cursorRef.current = null;
  }, [symbol, interval]);

  useEffect(() => {
    try {
      localStorage.setItem(`qe_draw_${symbol}_${interval}`, JSON.stringify(drawings));
    } catch {}
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings]);

  const addDrawing = (d) => setDrawings((p) => [...p, d]);
  const undo = () => setDrawings((p) => p.slice(0, -1));
  const clear = () => setDrawings([]);

  /* -------------------- Mount chart + event subscriptions -------------------- */
  useEffect(() => {
    if (!rootRef.current) return;
    const container = rootRef.current;

    const chart = createChart(container, {
      layout: { background: { color: theme.bg }, textColor: theme.text },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        borderColor: theme.gridBold,
        rightOffset: 8,
        barSpacing: 7,
        lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: { borderColor: theme.gridBold },
      autoSize: true,
      height,
    });

    const candles = chart.addCandlestickSeries({
      upColor: theme.up,
      borderUpColor: theme.up,
      wickUpColor: theme.up,
      downColor: theme.down,
      borderDownColor: theme.down,
      wickDownColor: theme.down,
    });
    const closeLine = chart.addLineSeries({ color: "#a8b3cf", lineWidth: 1, priceLineVisible: false });

    chartRef.current = chart;
    priceSeriesRef.current = candles;
    priceLineRef.current = closeLine;

    // overlay canvas (for drawings)
    const overlay = document.createElement("canvas");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.pointerEvents = "none"; // chart still receives clicks
    overlayRef.current = overlay;
    container.style.position = "relative";
    container.appendChild(overlay);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      overlay.width = Math.max(1, Math.floor(rect.width));
      overlay.height = Math.max(1, Math.floor(rect.height));
      drawOverlay();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // --- Drawing interactions using chart events ---
    const handleClick = (param) => {
      if (tool === "none") return;
      const p = param?.point;
      if (!p || param.time === undefined) return;

      const t = param.time;
      const price = chart.priceScale("right").coordinateToPrice(p.y);
      if (price == null) return;

      if (tool === "hline") {
        addDrawing({ type: "hline", y: price });
      } else if (tool === "trendline") {
        if (!partialRef.current) partialRef.current = { x: t, y: price };
        else {
          addDrawing({ type: "trendline", a: partialRef.current, b: { x: t, y: price } });
          partialRef.current = null;
        }
      } else if (tool === "fib") {
        if (!partialRef.current) partialRef.current = { x: t, y: price };
        else {
          addDrawing({ type: "fib", a: partialRef.current, b: { x: t, y: price } });
          partialRef.current = null;
        }
      }
      drawOverlay();
    };

    const handleCrosshair = (param) => {
      // live preview while placing second point
      if (!tool || tool === "none") return;
      cursorRef.current = param?.point || null;
      drawOverlay();
    };

    chart.subscribeClick(handleClick);
    chart.subscribeCrosshairMove(handleCrosshair);

    return () => {
      chart.unsubscribeClick(handleClick);
      chart.unsubscribeCrosshairMove(handleCrosshair);
      ro.disconnect();
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      overlayRef.current = null;
      for (const pane of [rsiPaneRef, macdPaneRef, stochPaneRef]) {
        try { pane.current?.remove?.(); } catch {}
        pane.current = null;
      }
      rsiSeriesRef.current = null;
      macdSeriesRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      stochKRef.current = null;
      stochDRef.current = null;
      emaSeriesRef.current = null;
      bbMidRef.current = null;
      bbUpperRef.current = null;
      bbLowerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  /* ----------------------- Load data & update ----------------------- */
  useEffect(() => {
    let alive = true;
    let unsub = null;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        let rows = await fetchOHLC(symbol, { interval, range });
        if (!rows || rows.length < 5) {
          rows = generateDemoOHLC(symbol, 240, undefined, interval);
          setErr("demo");
        }
        if (!alive || !priceSeriesRef.current) return;

        priceSeriesRef.current.setData(rows);
        priceLineRef.current?.setData(rows.map((d) => ({ time: d.time, value: d.close })));
        chartRef.current?.timeScale().fitContent();

        // EMA
        if (showEMA) {
          if (!emaSeriesRef.current) {
            emaSeriesRef.current = chartRef.current.addLineSeries({ color: theme.accent, lineWidth: 2, priceLineVisible: false });
          }
          emaSeriesRef.current.setData(ema(rows, 20));
        } else if (emaSeriesRef.current) emaSeriesRef.current.setData([]);

        // Bollinger
        if (showBB) {
          const b = boll(rows, 20, 2);
          if (!bbMidRef.current) bbMidRef.current = chartRef.current.addLineSeries({ color: "#94a3b8", lineWidth: 1 });
          if (!bbUpperRef.current) bbUpperRef.current = chartRef.current.addLineSeries({ color: "#64748b", lineWidth: 1 });
          if (!bbLowerRef.current) bbLowerRef.current = chartRef.current.addLineSeries({ color: "#64748b", lineWidth: 1 });
          bbMidRef.current.setData(b.mid);
          bbUpperRef.current.setData(b.upper);
          bbLowerRef.current.setData(b.lower);
        } else {
          for (const s of [bbMidRef.current, bbUpperRef.current, bbLowerRef.current]) s?.setData([]);
        }

        // RSI
        if (showRSI) {
          if (!rsiPaneRef.current) {
            const sub = createChart(rootRef.current, {
              layout: { background: { color: "transparent" }, textColor: theme.text },
              grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
              timeScale: { visible: false },
              rightPriceScale: { borderColor: theme.grid },
              height: 110,
              autoSize: true,
            });
            rsiSeriesRef.current = sub.addLineSeries({ color: theme.gold, lineWidth: 1 });
            rsiPaneRef.current = sub;
          }
          rsiSeriesRef.current.setData(rsi(rows, 14));
        } else if (rsiSeriesRef.current) rsiSeriesRef.current.setData([]);

        // MACD
        if (showMACD) {
          if (!macdPaneRef.current) {
            const sub = createChart(rootRef.current, {
              layout: { background: { color: "transparent" }, textColor: theme.text },
              grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
              timeScale: { visible: false },
              rightPriceScale: { borderColor: theme.grid },
              height: 110,
              autoSize: true,
            });
            macdSeriesRef.current = sub.addLineSeries({ color: theme.cyan, lineWidth: 1 });
            macdSignalRef.current = sub.addLineSeries({ color: theme.purple, lineWidth: 1 });
            macdHistRef.current = sub.addHistogramSeries({ base: 0 });
            macdPaneRef.current = sub;
          }
          const m = macdCalc(rows);
          macdSeriesRef.current.setData(m.macd);
          macdSignalRef.current.setData(m.signal);
          macdHistRef.current.setData(
            m.hist.map((h) => ({
              time: h.time,
              value: h.value,
              color: h.value >= 0 ? "rgba(52,211,153,.85)" : "rgba(251,113,133,.85)",
            }))
          );
        } else if (macdSeriesRef.current) {
          macdSeriesRef.current.setData([]);
          macdSignalRef.current.setData([]);
          macdHistRef.current.setData([]);
        }

        // Stoch
        if (showSTOCH) {
          if (!stochPaneRef.current) {
            const sub = createChart(rootRef.current, {
              layout: { background: { color: "transparent" }, textColor: theme.text },
              grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
              timeScale: { visible: false },
              rightPriceScale: { borderColor: theme.grid },
              height: 110,
              autoSize: true,
            });
            stochKRef.current = sub.addLineSeries({ color: theme.mint, lineWidth: 1 });
            stochDRef.current = sub.addLineSeries({ color: theme.rose, lineWidth: 1 });
            stochPaneRef.current = sub;
          }
          const s = stoch(rows, 14, 3);
          stochKRef.current.setData(s.k);
          stochDRef.current.setData(s.d);
        } else if (stochKRef.current) {
          stochKRef.current.setData([]);
          stochDRef.current.setData([]);
        }

        // live updates
        unsub = subscribeOHLC(symbol, {
          interval,
          everyMs: 5000,
          onBar: (bar) => {
            if (!priceSeriesRef.current) return;
            const last = rows[rows.length - 1];
            if (last && Number(last.time) === Number(bar.time)) rows[rows.length - 1] = bar;
            else if (!last || Number(bar.time) > Number(last.time)) rows.push(bar);

            priceSeriesRef.current.update(bar);
            priceLineRef.current?.update({ time: bar.time, value: bar.close });

            if (showEMA && emaSeriesRef.current) emaSeriesRef.current.setData(ema(rows, 20));
            if (showBB && bbMidRef.current) {
              const b = boll(rows, 20, 2);
              bbMidRef.current.setData(b.mid);
              bbUpperRef.current.setData(b.upper);
              bbLowerRef.current.setData(b.lower);
            }
            if (showRSI && rsiSeriesRef.current) rsiSeriesRef.current.setData(rsi(rows, 14));
            if (showMACD && macdSeriesRef.current) {
              const m = macdCalc(rows);
              macdSeriesRef.current.setData(m.macd);
              macdSignalRef.current.setData(m.signal);
              macdHistRef.current.setData(
                m.hist.map((h) => ({
                  time: h.time,
                  value: h.value,
                  color: h.value >= 0 ? "rgba(52,211,153,.85)" : "rgba(251,113,133,.85)",
                }))
              );
            }
            if (showSTOCH && stochKRef.current) {
              const s = stoch(rows, 14, 3);
              stochKRef.current.setData(s.k);
              stochDRef.current.setData(s.d);
            }
            drawOverlay();
          },
        });
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr("Failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, range, showEMA, showRSI, showMACD, showBB, showSTOCH]);

  /* ----------------------- Overlay rendering ----------------------- */
  const drawOverlay = () => {
    const canvas = overlayRef.current,
      chart = chartRef.current;
    if (!canvas || !chart) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ts = chart.timeScale();
    const ps = chart.priceScale("right");

    const drawFib = (a, b, preview = false) => {
      const x1 = ts.timeToCoordinate(a.x),
        y1 = ps.priceToCoordinate(a.y);
      const x2 = ts.timeToCoordinate(b.x),
        y2 = ps.priceToCoordinate(b.y);
      if ([x1, y1, x2, y2].some((v) => v == null)) return;

      const top = Math.min(y1, y2),
        bot = Math.max(y1, y2);
      const left = Math.min(x1, x2),
        right = Math.max(x1, x2);
      const w = right - left,
        h = bot - top;

      ctx.save();
      ctx.globalAlpha = preview ? 0.4 : 0.8;
      ctx.fillStyle = "rgba(96,165,250,0.08)";
      ctx.fillRect(left, top, w, h);

      const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textBaseline = "middle";
      levels.forEach((lv) => {
        const y = bot - (bot - top) * lv;
        ctx.strokeStyle = "rgba(148,163,184,0.7)";
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();

        if (!preview) {
          const txt = `${(lv * 100).toFixed(1)}%`;
          const boxW = ctx.measureText(txt).width + 8;
          ctx.fillStyle = "rgba(203,213,225,.85)";
          ctx.fillRect(right + 4, y - 9, boxW, 18);
          ctx.fillStyle = "#0b1220";
          ctx.fillText(txt, right + 8, y);
        }
      });

      ctx.strokeStyle = "rgba(96,165,250,0.6)";
      ctx.strokeRect(left, top, w, h);
      ctx.restore();
    };

    // existing drawings
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#93c5fd";
    drawings.forEach((d) => {
      if (d.type === "hline") {
        const y = ps.priceToCoordinate(d.y);
        if (y == null) return;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      } else if (d.type === "trendline") {
        const x1 = ts.timeToCoordinate(d.a.x),
          y1 = ps.priceToCoordinate(d.a.y);
        const x2 = ts.timeToCoordinate(d.b.x),
          y2 = ps.priceToCoordinate(d.b.y);
        if ([x1, y1, x2, y2].some((v) => v == null)) return;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (d.type === "fib") {
        drawFib(d.a, d.b, false);
      }
    });

    // preview (2nd point) if any
    if (partialRef.current && cursorRef.current) {
      const p = cursorRef.current;
      const time = chart.timeScale().coordinateToTime(p.x);
      const price = chart.priceScale("right").coordinateToPrice(p.y);
      if (time != null && price != null) {
        if (tool === "trendline") {
          const x1 = ts.timeToCoordinate(partialRef.current.x),
            y1 = ps.priceToCoordinate(partialRef.current.y);
        const x2 = p.x, y2 = p.y;
          if ([x1, y1, x2, y2].some((v) => v == null)) return;
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = "rgba(147,197,253,0.8)";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (tool === "fib") {
          drawFib(partialRef.current, { x: time, y: price }, true);
        }
      }
    }
  };
  useEffect(() => {
    const id = setInterval(drawOverlay, 600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------- UI ------------------------------- */
  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="absolute z-10 left-2 top-2 flex items-center gap-2 text-xs">
        <div className="px-2 py-1 rounded bg-black/40 border border-white/10 backdrop-blur-sm flex items-center gap-2">
          <span className="opacity-70">Draw:</span>
          <button className={`px-2 py-0.5 rounded ${tool==="trendline"?"bg-white/20":"hover:bg-white/10"}`} onClick={()=>setTool(tool==="trendline"?"none":"trendline")} title="Trendline">TL</button>
          <button className={`px-2 py-0.5 rounded ${tool==="hline"?"bg-white/20":"hover:bg-white/10"}`} onClick={()=>setTool(tool==="hline"?"none":"hline")} title="Horizontal">H</button>
          <button className={`px-2 py-0.5 rounded ${tool==="fib"?"bg-white/20":"hover:bg-white/10"}`} onClick={()=>setTool(tool==="fib"?"none":"fib")} title="Fibonacci">Fib</button>
          <button className="px-2 py-0.5 rounded hover:bg-white/10" onClick={undo} title="Undo">↶</button>
          <button className="px-2 py-0.5 rounded hover:bg-white/10" onClick={clear} title="Clear">✕</button>
        </div>
      </div>

      <div ref={rootRef} className="w-full rounded-lg overflow-hidden" style={{ background: theme.bg, height }} />
      <div className="px-1 py-1 text-[11px] text-right text-neutral-500">
        {loading ? "Loading…" : err === "demo" ? "Demo live feed" : "Live feed"}
      </div>
    </div>
  );
}
