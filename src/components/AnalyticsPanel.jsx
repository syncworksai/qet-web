// src/components/AnalyticsPanel.jsx
import React, { useEffect, useRef, useState } from "react";
import { api } from "../api/axios";
import * as LightweightCharts from "lightweight-charts"; // <-- namespace import

const fmtUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function Card({ children, className = "" }) {
  return (
    <div className={`bg-[color:var(--card)] border border-white/10 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function Stat({ label, value, money = false, suffix = "" }) {
  const display =
    value == null
      ? "—"
      : money
      ? fmtUSD.format(Number(value || 0))
      : suffix
      ? `${Number(value).toFixed(1)}${suffix}`
      : Number.isFinite(value)
      ? Number(value).toFixed(2)
      : String(value);

  return (
    <div className="bg-[color:var(--card)] border border-white/10 rounded-xl p-3">
      <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">{label}</div>
      <div className="text-lg font-semibold">{display}</div>
    </div>
  );
}

export default function AnalyticsPanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // Equity chart refs
  const eqContainerRef = useRef(null);
  const eqChartRef = useRef(null);

  // P&L chart refs
  const pnlContainerRef = useRef(null);
  const pnlChartRef = useRef(null);

  useEffect(() => {
    let ok = true;
    (async () => {
      setErr("");
      try {
        const res = await api.get("/api/journal/analytics/");
        if (!ok) return;
        setData(res.data || null);
      } catch (e) {
        console.error(e);
        if (ok) setErr("Failed to load analytics.");
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  // Build / update Equity Curve (Area)
  useEffect(() => {
    if (!data || !eqContainerRef.current) return;

    // destroy if exists
    if (eqChartRef.current?.remove) {
      eqChartRef.current.remove();
      eqChartRef.current = null;
    }

    const chart = LightweightCharts.createChart(eqContainerRef.current, {
      width: eqContainerRef.current.clientWidth,
      height: 280,
      layout: { background: { type: "solid", color: "transparent" }, textColor: "#ddd" },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderVisible: false },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: { mode: 1 },
      localization: {
        priceFormatter: (p) => fmtUSD.format(p),
      },
    });

    if (typeof chart.addAreaSeries !== "function") {
      console.warn(
        "[AnalyticsPanel] addAreaSeries not found. Check lightweight-charts version. Installing v4.x is recommended:\n  npm i lightweight-charts@^4"
      );
    }

    const area = chart.addAreaSeries
      ? chart.addAreaSeries({ lineWidth: 2, priceFormat: { type: "price", precision: 2, minMove: 0.01 } })
      : chart.addLineSeries({ lineWidth: 2, priceFormat: { type: "price", precision: 2, minMove: 0.01 } });

    const points = (data.equity || []).map((row) => ({
      time: row.date,
      value: Number(row.cum_pnl || 0),
    }));
    area.setData(points);

    const ro = new ResizeObserver(() => {
      if (!eqContainerRef.current) return;
      chart.applyOptions({ width: eqContainerRef.current.clientWidth });
    });
    ro.observe(eqContainerRef.current);

    eqChartRef.current = chart;
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data]);

  // Build / update Daily P&L (Histogram)
  useEffect(() => {
    if (!data || !pnlContainerRef.current) return;

    if (pnlChartRef.current?.remove) {
      pnlChartRef.current.remove();
      pnlChartRef.current = null;
    }

    const chart = LightweightCharts.createChart(pnlContainerRef.current, {
      width: pnlContainerRef.current.clientWidth,
      height: 220,
      layout: { background: { type: "solid", color: "transparent" }, textColor: "#ddd" },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderVisible: false },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      localization: {
        priceFormatter: (p) => fmtUSD.format(p),
      },
    });

    const hist = chart.addHistogramSeries
      ? chart.addHistogramSeries({ priceFormat: { type: "price", precision: 2, minMove: 0.01 }, base: 0 })
      : chart.addBarSeries({ priceFormat: { type: "price", precision: 2, minMove: 0.01 } }); // fallback

    const points = (data.daily || []).map((row) => {
      const v = Number(row.pnl || 0);
      return {
        time: row.date,
        value: v,
        color: v >= 0 ? "rgba(16, 185, 129, 0.8)" : "rgba(248, 113, 113, 0.8)", // green/red
      };
    });
    hist.setData(points);

    const ro = new ResizeObserver(() => {
      if (!pnlContainerRef.current) return;
      chart.applyOptions({ width: pnlContainerRef.current.clientWidth });
    });
    ro.observe(pnlContainerRef.current);

    pnlChartRef.current = chart;
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data]);

  if (err) {
    return (
      <Card>
        <div className="text-red-400 text-sm">{err}</div>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card>
        <div className="text-[color:var(--muted)] text-sm">Loading analytics…</div>
      </Card>
    );
  }

  const h = data.headline || {};

  return (
    <div className="space-y-4">
      {/* Headline stats (money where appropriate) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Trades" value={h.total_trades ?? "—"} />
        <Stat label="Win rate" value={h.win_rate ?? 0} suffix="%" />
        <Stat label="Net P&L" value={h.net_pnl ?? 0} money />
        <Stat label="Avg Win" value={h.avg_win ?? 0} money />
        <Stat label="Avg Loss" value={h.avg_loss ?? 0} money />
        <Stat label="Expectancy" value={h.expectancy ?? 0} money />
        <Stat label="Max Drawdown" value={h.max_drawdown ?? 0} money />
      </div>

      {/* Equity Curve */}
      <Card>
        <div className="text-sm uppercase tracking-wide text-[color:var(--muted)] mb-3">
          Equity Curve (Cumulative P&L)
        </div>
        <div ref={eqContainerRef} className="w-full" />
      </Card>

      {/* Daily P&L Histogram */}
      <Card>
        <div className="text-sm uppercase tracking-wide text-[color:var(--muted)] mb-3">
          Daily P&L
        </div>
        <div ref={pnlContainerRef} className="w-full" />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best Symbols */}
        <Card>
          <div className="text-sm uppercase tracking-wide text-[color:var(--muted)] mb-3">
            Best Symbols (by P&L)
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-[color:var(--muted)]">
              <tr>
                <th className="py-1 pr-3">Symbol</th>
                <th className="py-1 pr-3">Trades</th>
                <th className="py-1 pr-3">Win%</th>
                <th className="py-1 pr-3">P&L</th>
              </tr>
            </thead>
            <tbody>
              {(data.by_symbol || []).slice(0, 10).map((r) => (
                <tr key={r.symbol} className="border-t border-white/10">
                  <td className="py-1 pr-3">{r.symbol}</td>
                  <td className="py-1 pr-3">{r.trades}</td>
                  <td className="py-1 pr-3">{Number(r.win_rate || 0).toFixed(1)}%</td>
                  <td className={`py-1 pr-3 ${r.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmtUSD.format(Number(r.pnl || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Daily Summary table */}
        <Card>
          <div className="text-sm uppercase tracking-wide text-[color:var(--muted)] mb-3">
            Daily Summary
          </div>
          <div className="overflow-auto max-h-80 pr-1">
            <table className="w-full text-sm">
              <thead className="text-left text-[color:var(--muted)]">
                <tr>
                  <th className="py-1 pr-3">Date</th>
                  <th className="py-1 pr-3">Trades</th>
                  <th className="py-1 pr-3">Wins</th>
                  <th className="py-1 pr-3">Losses</th>
                  <th className="py-1 pr-3">P&L</th>
                </tr>
              </thead>
              <tbody>
                {(data.daily || [])
                  .slice(-90)
                  .reverse()
                  .map((r) => (
                    <tr key={r.date} className="border-t border-white/10">
                      <td className="py-1 pr-3">{r.date}</td>
                      <td className="py-1 pr-3">{r.trades}</td>
                      <td className="py-1 pr-3">{r.wins}</td>
                      <td className="py-1 pr-3">{r.losses}</td>
                      <td className={`py-1 pr-3 ${r.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {fmtUSD.format(Number(r.pnl || 0))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
