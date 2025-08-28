// src/components/Watchlist.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";

/* ---------------- color tokens (match TraderLab/Backtesting) ---------------- */
function readCssVar(name) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function fallbackTokens() {
  return {
    primary: "#4f46e5",
    secondary: "#7c3aed",
    accent: "#06b6d4",   // teal
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

/* ---------------- small inputs that keep the teal background ---------------- */
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

/* ---------------- Add Alert Modal (non-white background) ---------------- */
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal
      role="dialog"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      />
      {/* card */}
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

/* ---------------- Watchlist ---------------- */
export default function Watchlist({ onSelectSymbol }) {
  const tokens = useColorTokens();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [alertModal, setAlertModal] = useState({ open: false, symbol: null });

  const selectionBg = hexToRgba(tokens.accent, 0.35);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setLoading(true);
        // Try your backend; gracefully fall back to demo data
        let data = [];
        try {
          const res = await api.get("/api/market/watchlist/");
          data = res.data || [];
        } catch {
          data = [
            { symbol: "AAPL", asset_type: "stock" },
            { symbol: "NVDA", asset_type: "stock" },
            { symbol: "EURUSD", asset_type: "forex" },
            { symbol: "BTCUSD", asset_type: "crypto" },
          ];
        }
        if (ok) setItems(data);
      } catch (e) {
        console.error("load watchlist failed", e);
        if (ok) setItems([]);
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => { ok = false; };
  }, []);

  async function addSymbol() {
    const s = (newSymbol || "").trim().toUpperCase();
    if (!s) return;
    try {
      setAdding(true);
      // Try to persist; if endpoint differs, adjust here
      try { await api.post("/api/market/watchlist/", { symbol: s }); } catch {}
      setItems(prev => ([...prev, { symbol: s, asset_type: inferType(s) }]));
      setNewSymbol("");
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  }

  async function removeSymbol(symbol) {
    try {
      // Try to persist; if endpoint differs, adjust here
      try { await api.delete(`/api/market/watchlist/${encodeURIComponent(symbol)}/`); } catch {}
      setItems(prev => prev.filter(x => String(x.symbol).toUpperCase() !== String(symbol).toUpperCase()));
    } catch (e) {
      console.error(e);
    }
  }

  function openAlert(symbol) {
    setAlertModal({ open: true, symbol });
  }

  async function saveAlert({ symbol, dir, price, note }) {
    try {
      // Adjust endpoint/shape to your backend
      try {
        await api.post("/api/market/alerts/", {
          symbol,
          condition: dir,
          price: Number(price),
          note: note || "",
          // delivery: "inapp", // if you support
        });
      } catch {}
      setAlertModal({ open: false, symbol: null });
    } catch (e) {
      console.error(e);
      alert("Failed to save alert.");
    }
  }

  const rows = useMemo(() => {
    return (items || []).map(it => ({
      key: `${it.symbol}:${it.asset_type || "—"}`,
      symbol: it.symbol,
      type: it.asset_type || inferType(it.symbol),
    }));
  }, [items]);

  return (
    <div className="rounded-2xl p-4" style={{ border:`1px solid ${tokens.grid}` }}>
      <style>{`::selection { background: ${selectionBg}; }`}</style>
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Watchlist</div>
        <div className="flex gap-2">
          <Input
            value={newSymbol}
            onChange={setNewSymbol}
            placeholder="Add symbol (AAPL, EURUSD)"
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
                  <button
                    className="underline-offset-2"
                    style={{ color: tokens.accent }}
                    onClick={() => onSelectSymbol && onSelectSymbol({ symbol: r.symbol, asset_type: r.type })}
                  >
                    {r.symbol}
                  </button>
                </td>
                <td className="py-2 pr-4 uppercase">{r.type}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
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

      {/* Alert modal (teal card, no white) */}
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

/* ---------------- helpers ---------------- */
function inferType(symbol = "") {
  const s = String(symbol).toUpperCase().trim();
  if (/^[A-Z]{3}\/?[A-Z]{3}$/.test(s)) return "forex";
  if (/^BTC|ETH|SOL|DOGE|USDT|USDC|XRP/.test(s)) return "crypto";
  if (/^CL|GC|NG|SI|ZC|ZS|ZW|ES|NQ|YM/.test(s)) return "futures";
  return "stock";
}
