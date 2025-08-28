// src/components/NewsFeed.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/axios";

export default function NewsFeed({ symbol, assetType, category }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ok | empty | error

  // Prefer category for forex/crypto to avoid symbol gaps
  const effectiveCategory =
    category ||
    (assetType === "forex" ? "forex" :
     assetType === "crypto" ? "crypto" : "stocks");

  useEffect(() => {
    let alive = true;
    (async () => {
      setStatus("loading");
      try {
        const params = {};

        // For forex/crypto, omit symbol so backend uses topic query
        if (assetType !== "forex" && assetType !== "crypto" && symbol) {
          params.symbol = symbol;
          params.asset_type = assetType || "";
        } else {
          params.category = effectiveCategory;
          params.asset_type = assetType || "";
        }

        const res = await api.get("/api/news/", { params });
        if (!alive) return;

        const data = Array.isArray(res.data?.articles)
          ? res.data.articles
          : Array.isArray(res.data)
          ? res.data
          : [];

        if (!data.length) {
          setItems([]);
          setStatus("empty");
        } else {
          setItems(data);
          setStatus("ok");
        }
      } catch (e) {
        console.error("News fetch failed:", e);
        if (!alive) return;
        setItems([]);
        setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, [symbol, assetType, effectiveCategory]);

  if (status === "loading") return <div className="text-[color:var(--muted)]">Loading news…</div>;
  if (status === "empty") return <div className="text-[color:var(--muted)]">No recent articles.</div>;
  if (status === "error") return <div className="text-[color:var(--muted)]">News unavailable right now.</div>;

  return (
    <div className="space-y-3">
      {items.map((a, idx) => {
        const href = a.url || "#";
        const when = a.published_at ? new Date(a.published_at) : null;
        const whenStr = when
          ? when.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })
          : "—";
        return (
          <a
            key={a.id || idx}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-white/10 p-3 hover:bg-white/5 transition"
            title={href !== "#" ? "Open article in a new tab" : undefined}
          >
            <div className="text-sm text-[color:var(--muted)] mb-1">
              QE News · {whenStr}
            </div>
            <div className="font-semibold leading-snug">{a.title || "Untitled"}</div>
            {a.summary ? (
              <div className="text-sm opacity-90 mt-1 line-clamp-3"
                   dangerouslySetInnerHTML={{ __html: a.summary }} />
            ) : null}
          </a>
        );
      })}
    </div>
  );
}
