// src/components/SymbolAutocomplete.jsx
import React, { useEffect, useRef, useState } from "react";
import { api } from "../api/axios";
import { SYMBOL_SEARCH } from "../config/watchlist";

function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/**
 * Props:
 *  - value: string
 *  - onChange(text)
 *  - onPick({symbol, asset_type})
 *  - placeholder?: string
 */
export default function SymbolAutocomplete({ value, onChange, onPick, placeholder = "Search symbol…" }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(value, 250);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current || wrapRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => {
    (async () => {
      const q = (debounced || "").trim();
      if (!q) {
        setItems([]);
        setOpen(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get(SYMBOL_SEARCH, { params: { q } });
        const arr = Array.isArray(res.data) ? res.data : [];
        setItems(arr);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [debounced]);

  return (
    <div className="relative" ref={wrapRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded px-3 py-2 bg-background border border-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
        onFocus={() => { if (items.length) setOpen(true); }}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded border border-white/10 bg-[color:var(--card)] shadow">
          {loading && <div className="px-3 py-2 text-sm text-[color:var(--muted)]">Searching…</div>}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-sm text-[color:var(--muted)]">No matches</div>
          )}
          {items.map((it, i) => (
            <button
              key={`${it.display}-${i}`}
              onClick={() => { onPick?.({ symbol: it.symbol, asset_type: it.asset_type }); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-white/5"
              title={it.display}
            >
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-semibold">{it.symbol}</div>
                  <div className="text-xs opacity-80">{it.name || it.display}</div>
                </div>
                <div className="text-xs text-[color:var(--muted)] uppercase">{it.asset_type}</div>
              </div>
              {it.exchange && <div className="text-[10px] opacity-60 mt-0.5">{it.exchange}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
