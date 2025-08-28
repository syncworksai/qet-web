// src/components/BrokerConnections.jsx
import React, { useState } from "react";
import { uploadBacktestCSV } from "../api/journal";

export default function BrokerConnections() {
  const [file, setFile] = useState(null);
  const [broker, setBroker] = useState("TRADELOCKER");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    e.preventDefault();
    setResult(null);
    setError("");
    if (!file) return setError("Please choose a CSV file first.");
    try {
      setUploading(true);
      const data = await uploadBacktestCSV({
        file,
        broker,
        name,
        params: { rrTarget: 2 },
      });
      // data: { run_id, stats }
      setResult({
        run_id: data.run_id,
        rows_parsed: data?.stats?.n_trades ?? 0,
        preview: (data?.stats?.equity || []).slice(0, 10).map((p) => ({
          index: p.i + 1,
          equity: Number(p.equity).toFixed(2),
        })),
      });
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Upload failed.";
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* TradeLocker tile (placeholder for future API/webhook) */}
      <div className="bg-[color:var(--card)] border border-white/10 rounded-xl p-4">
        <div className="text-sm uppercase tracking-wide text-[color:var(--muted)] mb-1">
          Broker Link
        </div>
        <div className="text-xl font-semibold mb-2">TradeLocker</div>
        <p className="text-sm text-[color:var(--muted)] mb-3">
          Direct syncing (API/webhook) coming soon. You can import TradeLocker,
          MT4/5, or generic CSV exports today.
        </p>
        <button
          disabled
          className="px-3 py-2 rounded-lg border border-white/10 opacity-50 cursor-not-allowed"
          title="Coming soon"
        >
          Connect TradeLocker (soon)
        </button>
      </div>

      {/* CSV Import tile (wired to /journal/backtests/upload_csv/) */}
      <div className="bg-[color:var(--card)] border border-white/10 rounded-xl p-4">
        <div className="text-sm uppercase tracking-wide text-[color:var(--muted)] mb-1">
          Import
        </div>
        <div className="text-xl font-semibold mb-2">Import Trades (CSV)</div>
        <p className="text-sm text-[color:var(--muted)] mb-3">
          Upload fills/closed trades exported from your broker/platform. We’ll
          parse and compute an equity curve instantly.
        </p>

        <form onSubmit={handleUpload} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-[color:var(--muted)] mb-1">
                Broker
              </label>
              <select
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                className="w-full rounded px-2 py-2 bg-background border border-white/10"
              >
                <option value="TRADELOCKER">TradeLocker</option>
                <option value="MT4">MT4</option>
                <option value="MT5">MT5</option>
                <option value="GENERIC">Generic CSV</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text=[color:var(--muted)] mb-1">
                Run name (optional)
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., EURUSD H1 Jan–Mar"
                className="w-full rounded px-3 py-2 bg-background border border-white/10"
              />
            </div>
          </div>

          <div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-white/10 file:bg-[color:var(--bg)] file:text-white hover:file:bg-white/5"
            />
            <p className="text-xs text-[color:var(--muted)] mt-1">
              Generic CSV columns: <code>date,symbol,direction,entry,exit,size,fees</code>
            </p>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="px-3 py-2 rounded-lg bg-[color:var(--accent)] text-black font-semibold hover:brightness-110 transition disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload CSV"}
          </button>
        </form>

        {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}

        {result && (
          <div className="mt-4 text-sm">
            <div className="text-[color:var(--muted)] mb-1">
              Backtest run ID: <span className="text-white">{result.run_id}</span>
            </div>
            <div className="text-[color:var(--muted)] mb-1">
              Parsed rows: <span className="text-white">{result.rows_parsed}</span>
            </div>
            {result.preview?.length ? (
              <>
                <div className="text-[color:var(--muted)] mb-1">Equity preview:</div>
                <div className="border border-white/10 rounded-lg overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="text-left px-2 py-1 border-b border-white/10">#</th>
                        <th className="text-left px-2 py-1 border-b border-white/10">Equity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.preview.map((row, i) => (
                        <tr key={i} className="odd:bg-white/0 even:bg-white/[0.03]">
                          <td className="px-2 py-1 border-b border-white/5">{row.index}</td>
                          <td className="px-2 py-1 border-b border-white/5">{row.equity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
