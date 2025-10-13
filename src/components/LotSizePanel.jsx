// src/components/LotSizePanel.jsx
import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, Legend,
} from "recharts";

/** Small token set to match the dashboard look */
const tokens = {
  grid: "#263245",
  muted: "#9aa8bd",
  success: "#16a34a",
  danger: "#ef4444",
  primary: "#4f46e5",
};

const money = (v) =>
  (Number(v || 0)).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

/**
 * LotSizePanel
 * Props:
 *  - trades: array of trade rows already shown in TraderLab
 *  - pnlOf:  function to compute P&L for a row (provided by TraderLab)
 *
 * Groups by exact `size` value (string/number), then shows:
 *  trades, wins, losses, win%, net pnl
 */
export default function LotSizePanel({ trades = [], pnlOf }) {
  const rows = trades || [];
  const data = useMemo(() => {
    const map = new Map(); // key: normalized size string
    for (const t of rows) {
      // normalize to a short string; keep original if missing
      const raw = t?.size ?? "—";
      const key =
        typeof raw === "number"
          ? raw.toFixed(2)
          : String(raw || "—").trim();

      if (!map.has(key)) {
        map.set(key, { size: key, trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const agg = map.get(key);
      agg.trades += 1;

      const p = pnlOf ? Number(pnlOf(t) || 0) : 0;
      agg.pnl += p;
      if (p > 0) agg.wins += 1;
      else if (p < 0) agg.losses += 1;
    }

    const arr = Array.from(map.values()).map((r) => ({
      ...r,
      winRate: r.trades ? (r.wins / r.trades) * 100 : 0,
    }));

    // sort by numeric size when possible, otherwise by string
    arr.sort((a, b) => {
      const na = Number(a.size);
      const nb = Number(b.size);
      const aNum = Number.isFinite(na);
      const bNum = Number.isFinite(nb);
      if (aNum && bNum) return na - nb;
      if (aNum) return -1;
      if (bNum) return 1;
      return String(a.size).localeCompare(String(b.size));
    });

    return arr;
  }, [rows, pnlOf]);

  return (
    <div className="rounded-xl border p-3 md:p-4" style={{ borderColor: tokens.grid }}>
      <div className="font-medium mb-2">P&amp;L by Lot Size</div>

      {/* Chart */}
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke={tokens.grid} strokeDasharray="3 3" />
            <XAxis dataKey="size" stroke={tokens.muted} />
            <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(v) => v + "%"} stroke={tokens.muted} />
            <YAxis yAxisId="right" orientation="right" allowDecimals={false} stroke={tokens.muted} />
            <Legend wrapperStyle={{ color: tokens.muted }} />
            <ReTooltip
              contentStyle={{
                borderRadius: 12,
                background: "#0b1220",
                border: "1px solid " + tokens.grid,
                color: "#e5edf7",
              }}
              formatter={(value, name) => {
                if (name === "Win %") return [ (value && value.toFixed ? value.toFixed(0) : value) + "%", "Win %" ];
                if (name === "Trades") return [ value, "Trades" ];
                if (name === "Net P&L") return [ money(value), "Net P&L" ];
                return [ value, name ];
              }}
            />
            <Bar name="Win %" dataKey="winRate" yAxisId="left" fill="#94a3b8" />
            <Bar name="Trades" dataKey="trades" yAxisId="right" fill="#60a5fa" />
            <Bar name="Net P&L" dataKey="pnl" yAxisId="right" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-auto">
        <table className="min-w-full text-[13px]">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: tokens.grid }}>
              <th className="py-1.5 pr-3 text-xs" style={{ color: tokens.muted }}>Size</th>
              <th className="py-1.5 pr-3 text-xs" style={{ color: tokens.muted }}>Trades</th>
              <th className="py-1.5 pr-3 text-xs" style={{ color: tokens.muted }}>Wins</th>
              <th className="py-1.5 pr-3 text-xs" style={{ color: tokens.muted }}>Losses</th>
              <th className="py-1.5 pr-3 text-xs" style={{ color: tokens.muted }}>Win %</th>
              <th className="py-1.5 pr-3 text-xs" style={{ color: tokens.muted }}>Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.size} className="border-b" style={{ borderColor: tokens.grid }}>
                <td className="py-1.5 pr-3">{r.size}</td>
                <td className="py-1.5 pr-3">{r.trades}</td>
                <td className="py-1.5 pr-3">{r.wins}</td>
                <td className="py-1.5 pr-3">{r.losses}</td>
                <td className="py-1.5 pr-3">{r.winRate.toFixed(1)}%</td>
                <td className="py-1.5 pr-3" style={{ color: r.pnl >= 0 ? tokens.success : tokens.danger }}>
                  {money(r.pnl)}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="py-3 text-sm" colSpan={6} style={{ color: tokens.muted }}>
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
