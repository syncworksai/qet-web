import React, { useEffect, useState } from "react";
import { AlertsAPI } from "../api/alerts";

export default function AlertCenter({ open, onClose }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!open) return;
    AlertsAPI.events().then(setEvents).catch(()=>{});
    const id = setInterval(() => AlertsAPI.events().then(setEvents).catch(()=>{}), 10000);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[color:var(--card)] border-l border-white/10 pointer-events-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Alert Center</div>
          <button onClick={onClose} className="px-2 py-1 border border-white/15 rounded">Close</button>
        </div>
        <div className="space-y-2 overflow-auto h-[calc(100%-48px)] pr-1">
          {events.length === 0 ? (
            <div className="text-[color:var(--muted)]">No recent alerts.</div>
          ) : events.map(ev => (
            <div key={ev.id} className="p-3 rounded border border-white/10">
              <div className="text-sm font-semibold">{ev.alert.symbol} — {ev.alert.rule_type}</div>
              <div className="text-xs opacity-80">
                {new Date(ev.triggered_at).toLocaleString()} · price: {ev.price ?? "—"}
              </div>
              {ev.note && <div className="text-xs mt-1">{ev.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
