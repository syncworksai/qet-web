// src/components/Watchlist.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";

/* ---------------- color tokens ---------------- */
function readCssVar(name) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function fallbackTokens() {
  return {
    primary: "#4f46e5",
    secondary: "#7c3aed",
    accent: "#06b6d4",
    success: "#10b981",
    danger: "#ef4444",
    warning: "#f59e0b",
    info: "#0ea5e9",
    muted: "#94a3b8",
    grid: "#e5e7eb",
  };
}
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function useColorTokens() {
  const [tokens, setTokens] = useState(fallbackTokens());
  useEffect(() => {
    const fb = fallbackTokens();
    setTokens({
      primary: readCssVar("--color-primary") || fb.primary,
      secondary: readCssVar("--color-secondary") || fb.secondary,
      accent: readCssVar("--color-accent") || fb.accent,
      success: readCssVar("--color-success") || fb.success,
      danger: readCssVar("--color-danger") || fb.danger,
      warning: readCssVar("--color-warning") || fb.warning,
      info: readCssVar("--color-info") || fb.info,
      muted: readCssVar("--color-muted") || fb.muted,
      grid: readCssVar("--color-grid") || fb.grid,
    });
  }, []);
  return tokens;
}

/* ---------------- small inputs ---------------- */
function Input({ label, value, onChange, type = "text", placeholder, tokens }) {
  return (
    <div>
      {label && <label className="text-xs" style={{ color: tokens.muted }}>{label}</label>}
      <input
        className="w-full rounded-xl px-3 py-2 border focus:outline-none"
        style={{
          borderColor: hexToRgba(tokens.accent, 0.35),
          background: hexToRgba(tokens.accent, 0.10),
          color: tokens.accent,
        }}
        type={type}
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
function Select({ label, value, onChange, options, tokens }) {
  return (
    <div>
      {label && <label className="text-xs" style={{ color: tokens.muted }}>{label}</label>}
      <select
        className="w-full rounded-xl px-3 py-2 border focus:outline-none"
        style={{
          borderColor: hexToRgba(tokens.accent, 0.35),
          background: hexToRgba(tokens.accent, 0.10),
          color: tokens.accent,
        }}
        value={value}
        onChange={(e)=>onChange(e.target.value)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ---------------- Add Alert Modal ---------------- */
function AddAlertModal({ open, symbol, onClose, onSubmit, tokens }) {
  const [dir, setDir] = useState("above");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) { setDir("above"); setPrice(""); setNote(""); }
  }, [open]);

  if (!open) return null;

  const selectionBg = hexToRgba(tokens.accent, 0.35);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal role="dialog">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-4 border"
        style={{ borderColor: tokens.grid, background: hexToRgba(tokens.accent, 0.06) }}
      >
        <style>{`::selection { background: ${selectionBg}; }`}</style>
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Add Alert</div>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded-lg text-sm"
            style={{ border:`1px solid ${tokens.grid}`, color: tokens.muted }}
          >
            Close
          </button>
        </div>
        <div className="text-xs mb-3" style={{ color: tokens.muted }}>
          Symbol: <span className="font-medium" style={{ color: tokens.accent }}>{(symbol || "").toUpperCase()}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Condition"
            value={dir}
            onChange={setDir}
            tokens={tokens}
            options={[
              { label: "Crosses Above", value: "above" },
              { label: "Crosses Below", value: "below" },
            ]}
          />
          <Input
            label="Trigger Price"
            value={price}
            onChange={setPrice}
            type="number"
            tokens={tokens}
            placeholder="e.g. 185.50"
          />
          <div className="col-span-2">
            <label className="text-xs" style={{ color: tokens.muted }}>Note (optional)</label>
            <textarea
              className="w-full rounded-xl px-3 py-2 border focus:outline-none"
              style={{
                borderColor: hexToRgba(tokens.accent, 0.35),
                background: hexToRgba(tokens.accent, 0.10),
                color: tokens.accent,
              }}
              rows={2}
              value={note}
              onChange={(e)=>setNote(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: tokens.grid }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ symbol, dir, price, note })}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: tokens.primary, color: "white" }}
            disabled={!price}
          >
            Save Alert
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers for symbol/type ---------------- */
function normalizeSymbol(s = "") {
  return String(s).toUpperCase().replace(/\s+/g, "").replace("/", "");
}

/** Keep types aligned with the chart resolver */
function inferType(symbol = "") {
  const s = normalizeSymbol(symbol);

  // Metals & energy common spot tickers (we route via OANDA/FOREXCOM in the chart)
  if (["XAUUSD", "XAGUSD", "XTIUSD", "XBRUSD"].includes(s)) return "forex";

  // 6-letter forex pairs
  if (/^[A-Z]{6}$/.test(s)) return "forex";

  // Crypto
  if (/(USDT|USDC)$/.test(s) || /^(BTC|ETH|SOL|XRP|DOGE|ADA)$/.test(s)) return "crypto";

  // Indices
  if (["SPX","NDX","DJI","DAX","UK100","NAS100"].includes(s)) return "index";

  return "stock";
}

/* ---------------- storage helpers (fallback if API unavailable) ---------------- */
const LS_KEY = "qe_watchlist";

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return arr;
  } catch { return null; }
}
function saveToLocalStorage(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list || [])); } catch {}
}

/* ---------------- Watchlist ---------------- */
export default function Watchlist({ onSelectSymbol }) {
  const tokens = useColorTokens();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [alertModal, setAlertModal] = useState({ open: false, symbol: null });
  const [error, setError] = useState("");

  const selectionBg = hexToRgba(tokens.accent, 0.35);

  // Initial load: try backend, else localStorage fallback
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        let data = [];
        try {
          const res = await api.get("/api/market/watchlist/");
          data = res.data || [];
        } catch (e) {
          // Fallback to localStorage if API fails
          const ls = loadFromLocalStorage();
          data = ls ?? [
            { symbol: "AAPL", asset_type: "stock" },
            { symbol: "NVDA", asset_type: "stock" },
            { symbol: "EURUSD", asset_type: "forex" },
            { symbol: "BTCUSDT", asset_type: "crypto" },
            { symbol: "XAUUSD", asset_type: "forex" },
          ];
        }
        // normalize
        const normalized = (data || []).map(x => ({
          symbol: normalizeSymbol(x.symbol),
          asset_type: x.asset_type || inferType(x.symbol),
        }));
        if (ok) {
          setItems(normalized);
          saveToLocalStorage(normalized);
        }
      } catch (e) {
        console.error("load watchlist failed", e);
        if (ok) {
          setItems([]);
          setError("Failed to load watchlist.");
        }
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => { ok = false; };
  }, []);

  // De-dupe helper
  function exists(sym) {
    const s = normalizeSymbol(sym);
    return items.some(it => normalizeSymbol(it.symbol) === s);
  }

  async function addSymbol() {
    const input = normalizeSymbol(newSymbol);
    if (!input) return;
    if (exists(input)) {
      setError(`${input} is already in your watchlist.`);
      return;
    }
    const entry = { symbol: input, asset_type: inferType(input) };

    try {
      setAdding(true);
      setError("");
      // Optimistic UI
      setItems(prev => {
        const next = [...prev, entry];
        saveToLocalStorage(next);
        return next;
      });
      // Best-effort persist to backend
      try { await api.post("/api/market/watchlist/", entry); } catch {}
      setNewSymbol("");
    } catch (e) {
      console.error(e);
      setError("Failed to add symbol.");
    } finally {
      setAdding(false);
    }
  }

  async function removeSymbol(symbol) {
    const s = normalizeSymbol(symbol);
    try {
      setItems(prev => {
        const next = prev.filter(x => normalizeSymbol(x.symbol) !== s);
        saveToLocalStorage(next);
        return next;
      });
      try { await api.delete(`/api/market/watchlist/${encodeURIComponent(s)}/`); } catch {}
    } catch (e) {
      console.error(e);
      setError("Failed to remove symbol.");
    }
  }

  function openAlert(symbol) {
    setAlertModal({ open: true, symbol: normalizeSymbol(symbol) });
  }

  async function saveAlert({ symbol, dir, price, note }) {
    const s = normalizeSymbol(symbol);
    try {
      try {
        await api.post("/api/market/alerts/", {
          symbol: s,
          condition: dir,
          price: Number(price),
          note: note || "",
        });
      } catch {}
      setAlertModal({ open: false, symbol: null });
    } catch (e) {
      console.error(e);
      alert("Failed to save alert.");
    }
  }

  const rows = useMemo(() => {
    return (items || []).map(it => {
      const sym = normalizeSymbol(it.symbol);
      return {
        key: `${sym}:${it.asset_type || "—"}`,
        symbol: sym,
        type: it.asset_type || inferType(sym),
      };
    });
  }, [items]);

  return (
    <div className="rounded-2xl p-4" style={{ border:`1px solid ${tokens.grid}` }}>
      <style>{`::selection { background: ${selectionBg}; }`}</style>

      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Watchlist</div>
        <div className="flex gap-2">
          <Input
            value={newSymbol}
            onChange={(v)=>{ setNewSymbol(v); setError(""); }}
            placeholder="Add symbol (AAPL, XAUUSD, EURUSD)"
            tokens={tokens}
          />
          <button
            onClick={addSymbol}
            className="px-3 py-2 rounded-xl"
            style={{ background: tokens.primary, color: "white" }}
            disabled={adding || !newSymbol.trim()}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 text-xs rounded-lg px-2 py-1"
             style={{ color: tokens.danger, background: hexToRgba(tokens.danger, 0.08), border:`1px solid ${hexToRgba(tokens.danger,0.35)}` }}>
          {error}
        </div>
      )}

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: tokens.grid }}>
              <th className="py-2 pr-4 text-xs font-semibold" style={{ color: tokens.muted }}>Symbol</th>
              <th className="py-2 pr-4 text-xs font-semibold" style={{ color: tokens.muted }}>Type</th>
              <th className="py-2 pr-4 text-xs font-semibold" style={{ color: tokens.muted }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className="border-b"
                style={{ borderColor: tokens.grid, transition: "background 120ms" }}
                onMouseEnter={(e)=>e.currentTarget.style.background = hexToRgba(tokens.accent, 0.06)}
                onMouseLeave={(e)=>e.currentTarget.style.background = "transparent"}
              >
                <td className="py-2 pr-4">
                  <span style={{ color: tokens.accent }}>{r.symbol}</span>
                </td>
                <td className="py-2 pr-4 uppercase">{r.type}</td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-2">
                    {/* NEW: View Chart button */}
                    <button
                      className="px-2 py-1 rounded-lg text-xs border"
                      style={{ borderColor: tokens.grid, background: hexToRgba(tokens.accent, 0.10), color: tokens.accent }}
                      onClick={() => onSelectSymbol && onSelectSymbol({ symbol: r.symbol, asset_type: r.type })}
                      title={`Open ${r.symbol} chart`}
                    >
                      View Chart
                    </button>
                    <button
                      className="px-2 py-1 rounded-lg text-xs border"
                      style={{ borderColor: tokens.grid }}
                      onClick={() => openAlert(r.symbol)}
                    >
                      Add Alert
                    </button>
                    <button
                      className="px-2 py-1 rounded-lg text-xs border"
                      style={{ borderColor: tokens.grid, color: tokens.danger, background: hexToRgba(tokens.danger, 0.06) }}
                      onClick={() => removeSymbol(r.symbol)}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="py-4 text-sm" style={{ color: tokens.muted }} colSpan={3}>
                  {loading ? "Loading…" : "No symbols yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Alert modal */}
      <AddAlertModal
        open={alertModal.open}
        symbol={alertModal.symbol}
        onClose={() => setAlertModal({ open: false, symbol: null })}
        onSubmit={saveAlert}
        tokens={tokens}
      />
    </div>
  );
}
