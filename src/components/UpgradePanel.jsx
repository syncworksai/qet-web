// src/components/UpgradePanel.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/axios";
import { PAYLINKS } from "../config/commerce";

const PRODUCTS = [
  { key: "webinars", label: "Live Webinars", link: PAYLINKS.webinars },
  { key: "courses",  label: "Courses",       link: PAYLINKS.courses  },
  { key: "coaching", label: "Coaching",      link: PAYLINKS.coaching },
];

export default function UpgradePanel() {
  const [ents, setEnts] = useState([]);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const { data } = await api.get("/billing/subscription/status/");
        if (ok) setEnts(data?.entitlements || []);
      } catch {
        // ignore; user may be logged out in dev preview
      }
    })();
    return () => (ok = false);
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-[color:var(--card,#0B0B10)]">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-400">Add-ons</div>
        <div className="text-xs text-neutral-500">Quick access</div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-3">
        {PRODUCTS.map((p) => {
          const owned = ents.includes(p.key);
          return (
            <a
              key={p.key}
              href={p.link}
              target="_blank"
              rel="noreferrer"
              className={`rounded-xl border p-3 ${owned ? "pointer-events-none opacity-50" : "hover:bg-white/5"}`}
              style={{ borderColor: "rgba(255,255,255,0.10)" }}
            >
              <div className="font-medium text-neutral-100">{p.label}</div>
              <div className="text-xs text-neutral-400">{owned ? "Active" : "Subscribe"}</div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
