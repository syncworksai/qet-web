// src/components/PreTradeChecklist.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/axios";

/**
 * Props:
 * - open: boolean
 * - mode: "live" | "demo"
 * - onCancel: () => void
 * - onConfirm: (answersArray) => void
 */
export default function PreTradeChecklist({ open, mode = "live", onCancel, onConfirm }) {
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let ok = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/journal/checklist/items/");
        if (!ok) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setItems(list);
        const init = {};
        list.forEach((i) => (init[i.id] = false));
        setAnswers(init);
      } catch (e) {
        console.error("load checklist failed", e);
        setItems([]);
        setAnswers({});
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, [open]);

  if (!open) return null;

  const allChecked = items.length ? items.every((i) => !!answers[i.id]) : false;
  const requireAll = mode === "live";

  const confirm = () => {
    const out = items.map((i) => ({ item: i.id, checked: !!answers[i.id] }));
    onConfirm?.(out);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[color:var(--card)] border border-white/10 rounded-xl p-5">
        <div className="text-lg font-semibold mb-2">Pre-Trade Checklist</div>
        <div className="text-sm text-[color:var(--muted)] mb-3">
          Mode: <b className="text-white">{mode.toUpperCase()}</b>
          {requireAll ? " — all checks required" : " — optional"}
        </div>

        {loading ? (
          <div className="text-[color:var(--muted)] text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-[color:var(--muted)] text-sm">No checklist items.</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {items.map((it) => (
              <label key={it.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!answers[it.id]}
                  onChange={() => setAnswers((a) => ({ ...a, [it.id]: !a[it.id] }))}
                />
                <span>{it.text}</span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-2 border border-white/15 rounded">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={requireAll && !allChecked}
            className={`px-3 py-2 rounded font-semibold ${
              requireAll && !allChecked
                ? "bg-white/10 text-[color:var(--muted)] cursor-not-allowed"
                : "bg-[color:var(--accent)] text-black hover:brightness-110"
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
