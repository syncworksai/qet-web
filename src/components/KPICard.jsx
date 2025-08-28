// src/components/KPICard.jsx
import React from "react";

export default function KPICard({ label, value, accent = false }) {
  return (
    <div className={`rounded-xl border ${accent ? "border-[color:var(--accent)]/60" : "border-white/10"} bg-[color:var(--card)] p-3`}>
      <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">{label}</div>
      <div className="text-lg font-semibold">{value ?? "—"}</div>
    </div>
  );
}
