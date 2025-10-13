// src/components/LockedCard.jsx
import React from "react";

const tokens = { grid: "#263245", primary: "#4f46e5", muted: "#9aa8bd" };

// Default URL fallback (Trade Desk)
const DEFAULT_URL =
  import.meta?.env?.VITE_TRADE_DESK_STRIPE_URL ||
  "https://buy.stripe.com/eVq6oHbCGgPt5yNeBd2Nq06";

export default function LockedCard({ title, feature, purchaseUrl, onRefetch }) {
  const url = purchaseUrl || DEFAULT_URL;

  return (
    <div className="min-h-[55vh] grid place-items-center">
      <div
        className="rounded-2xl p-6 md:p-8 w-full max-w-xl"
        style={{ background: "#0b1220", border: `1px solid ${tokens.grid}` }}
      >
        <div className="text-2xl font-semibold mb-2">{title || "Locked"}</div>
        <div className="text-sm mb-6" style={{ color: tokens.muted }}>
          {feature || "This content is available to subscribers."}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg text-white text-center"
              style={{ background: tokens.primary }}
            >
              Subscribe
            </a>
          )}
          <button
            className="px-4 py-2 rounded-lg border"
            style={{ borderColor: tokens.grid }}
            onClick={onRefetch}
          >
            I already subscribed — Recheck
          </button>
        </div>

        <div className="text-xs mt-4" style={{ color: tokens.muted }}>
          After completing payment, click “Recheck”. If it still shows locked, refresh
          the page — it can take a moment to sync.
        </div>
      </div>
    </div>
  );
}
