import React, { useEffect, useState } from "react";
import { AlertsAPI } from "../api/alerts";

const RULES = [
  { value: "price_above", label: "Price crosses above" },
  { value: "price_below", label: "Price crosses below" },
  { value: "pct_change_gt", label: "% change intraday >" },
];

export default function AddAlertModal({ open, onClose, symbol, assetType, onCreated }) {
  const [ruleType, setRuleType] = useState("price_above");
  const [threshold, setThreshold] = useState("");
  const [quote, setQuote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    if (open && symbol) {
      AlertsAPI.quote(symbol, assetType).then(setQuote).catch(()=>{});
    }
  }, [open, symbol, assetType]);

  const save = async (e) => {
    e.preventDefault();
    setErr("");
    if (!symbol) return setErr("No symbol.");
    const th = parseFloat(threshold);
    if (isNaN(th)) return setErr("Enter a numeric threshold.");

    try {
      setSaving(true);
      await AlertsAPI.create({ symbol, asset_type: assetType, rule_type: ruleType, threshold: th, is_active: true });
      onCreated?.();
      onClose?.();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Failed to create alert.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[color:var(--card)] border border-white/10 rounded-xl p-4">
        <div className="text-lg font-semibold mb-1">Add Alert</div>
        <div className="text-sm text-[color:var(--muted)] mb-3">
          {symbol} ({assetType})
        </div>

        {quote && (
          <div className="mb-3 text-sm">
            Last: <span className="font-semibold">{quote.price ?? "—"}</span>
            {quote.pct_change != null && (
              <span className="ml-2 opacity-80">({quote.pct_change.toFixed(2)}%)</span>
            )}
          </div>
        )}

        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Rule</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
              className="w-full rounded px-2 py-2 bg-background border border-white/10"
            >
              {RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[color:var(--muted)] mb-1">Threshold</label>
            <input
              type="number"
              step="any"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full rounded px-3 py-2 bg-background border border-white/10"
              placeholder="e.g. 195 (price) or 3 (% change)"
            />
          </div>

          {err && <div className="text-red-400 text-sm">{err}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 border border-white/15 rounded">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-2 bg-[color:var(--accent)] text-black rounded font-semibold">
              {saving ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
