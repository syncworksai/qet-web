// src/hooks/useRealtimeFeed.js
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Twelve Data poller for FX/Metals
 * - tf: "1m" | "5m" | "10m" | "15m" | "30m" | "1h"
 * - opts: { maxBars?:number, pollMs?:number, jitterMs?:number }
 */
export function useRealtimeFeed(symbol, tf, opts = {}) {
  const maxBars  = Number.isFinite(opts.maxBars)  ? Number(opts.maxBars)  : 500;
  const pollMs   = Number.isFinite(opts.pollMs)   ? Number(opts.pollMs)   : 25_000; // slow a bit
  const jitterMs = Number.isFinite(opts.jitterMs) ? Number(opts.jitterMs) : 1200;   // spread calls

  const apiKey = (import.meta.env?.VITE_TWELVE_DATA_KEY || "").trim();
  const provider = (import.meta.env?.VITE_FEED_PROVIDER || "twelvedata").toLowerCase();

  const [candles, setCandles] = useState([]);
  const [status, setStatus]   = useState("loading"); // "ok" | "loading" | "error" | "closed"
  const [reason, setReason]   = useState("");        // "auth" | "net" | "provider"

  const interval = useMemo(() => {
    const map = { "1m": "1min", "5m": "5min", "10m": "10min", "15m": "15min", "30m": "30min", "1h": "1h" };
    return map[tf] || "1h";
  }, [tf]);

  // symbol -> "XAU/USD" format for TD
  const tdSymbol = useMemo(() => {
    if (!symbol) return "";
    return symbol.includes("/") ? symbol : `${symbol.slice(0,3)}/${symbol.slice(3,6)}`;
  }, [symbol]);

  const abortRef = useRef(null);

  useEffect(() => {
    if (provider !== "twelvedata") {
      setStatus("error"); setReason("provider");
      return;
    }
    if (!apiKey) {
      setStatus("error"); setReason("auth");
      return;
    }

    let alive = true;
    async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

    async function fetchSeries(first = false) {
      try {
        // add jitter so all panes don’t call at once
        if (first) await sleep(Math.random() * jitterMs);

        const ctrl = new AbortController();
        abortRef.current = ctrl;

        const params = new URLSearchParams({
          symbol: tdSymbol,
          interval,
          outputsize: "400",
          format: "JSON",
          apikey: apiKey,
        });
        const url = `https://api.twelvedata.com/time_series?${params}`;

        const res  = await fetch(url, { signal: ctrl.signal });
        const json = await res.json().catch(() => ({}));

        // Non-200 or TD error payload
        if (!res.ok || json?.status === "error" || json?.code) {
          const msg = (json?.message || "").toLowerCase();
          const auth = res.status === 401 || res.status === 403 || /apikey|permission|access/.test(msg);
          if (alive) {
            setStatus("error");
            setReason(auth ? "auth" : "net");
          }
          return;
        }

        const values = Array.isArray(json?.values) ? json.values : [];
        // If TD throttles, values may be empty; keep previous data but don’t crash
        if (!values.length) {
          if (alive && candles.length === 0) {
            setStatus("error"); setReason("net");
          }
          return;
        }

        // TD returns newest first — reverse + normalize
        const rows = values
          .slice()
          .reverse()
          .map((r) => {
            const t = Math.floor(new Date((r.datetime || "").replace(" ", "T") + "Z").getTime() / 1000);
            const o = Number(r.open), h = Number(r.high), l = Number(r.low), c = Number(r.close);
            return (Number.isFinite(t) && [o,h,l,c].every(Number.isFinite))
              ? { time: t, open: o, high: h, low: l, close: c, volume: r.volume != null ? Number(r.volume) : undefined }
              : null;
          })
          .filter(Boolean);

        if (alive && rows.length) {
          setCandles(rows.slice(-maxBars));
          setStatus("ok"); setReason("");
        }
      } catch (e) {
        if (!alive) return;
        setStatus("error"); setReason(e?.name === "AbortError" ? "net" : "net");
      }
    }

    // initial fetch + poller
    setStatus("loading"); setReason("");
    fetchSeries(true);
    const id = setInterval(fetchSeries, pollMs);

    return () => {
      alive = false;
      clearInterval(id);
      try { abortRef.current?.abort(); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdSymbol, interval, apiKey, provider, maxBars, pollMs, jitterMs]);

  return { candles, status, reason };
}
