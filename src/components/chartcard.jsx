import React, { useEffect, useMemo, useRef, useState } from "react";
import { resolveTradingViewCandidates, candidateLabel } from "../utils/symbolResolver";

const TV_SRC = "https://s3.tradingview.com/tv.js";

function useTradingViewScript() {
  const [ready, setReady] = useState(!!window.TradingView);
  useEffect(() => {
    if (window.TradingView) { setReady(true); return; }
    const existing = document.querySelector(`script[src="${TV_SRC}"]`);
    if (existing) { existing.addEventListener("load", () => setReady(true), { once: true }); return; }
    const s = document.createElement("script");
    s.src = TV_SRC; s.async = true; s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, []);
  return ready;
}

// Small helper to build an external TradingView link for the candidate
function tvExternalLink(tvSymbol) {
  // e.g. OANDA:XAUUSD => https://www.tradingview.com/symbols/OANDA-XAUUSD/
  const [ex, sym] = String(tvSymbol).split(":");
  if (!ex || !sym) return "https://www.tradingview.com/";
  return `https://www.tradingview.com/symbols/${encodeURIComponent(ex)}-${encodeURIComponent(sym)}/`;
}

export default function ChartCard({ active }) {
  const wrapperRef = useRef(null);
  const widgetRef = useRef(null);

  // selection controls
  const [forcedIdx, setForcedIdx] = useState(null);
  const [tryingIdx, setTryingIdx] = useState(null);
  const [lastGoodSymbol, setLastGoodSymbol] = useState(null);
  const [errorSymbol, setErrorSymbol] = useState(null); // store the tvSymbol that failed last

  const ready = useTradingViewScript();
  const symbol = (active?.symbol || "AAPL").toUpperCase().trim();
  const type = (active?.asset_type || "stock").toUpperCase().trim();

  // Reset memory whenever the base input changes
  useEffect(() => {
    setTryingIdx(null);
    setForcedIdx(null);
    setLastGoodSymbol(null);
    setErrorSymbol(null);
  }, [symbol, type]);

  // Candidates, but for XAUUSD explicitly bias FOREXCOM first (often most reliable on the embed)
  const rawCandidates = useMemo(() => resolveTradingViewCandidates(symbol, type), [symbol, type]);
  const candidates = useMemo(() => {
    if (symbol === "XAUUSD") {
      const pref = ["FOREXCOM:XAUUSD", "OANDA:XAUUSD", "FX_IDC:XAUUSD", "TVC:GOLD"];
      const rest = rawCandidates.filter(c => !pref.includes(c));
      return [...pref, ...rest.filter(c => !/^FX:/i.test(c))];
    }
    return rawCandidates.filter(c => !/^FX:/i.test(c)); // never try FX:
  }, [rawCandidates, symbol]);

  // Order: forced → last known good → others
  const ordered = useMemo(() => {
    if (forcedIdx != null && candidates[forcedIdx]) {
      // If forced, try that only; if it fails, show error (no silent fallbacks)
      return [candidates[forcedIdx]];
    }
    if (lastGoodSymbol && candidates.includes(lastGoodSymbol)) {
      return [lastGoodSymbol, ...candidates.filter(c => c !== lastGoodSymbol)];
    }
    return candidates;
  }, [candidates, forcedIdx, lastGoodSymbol]);

  useEffect(() => {
    if (!ready || !wrapperRef.current) return;

    let disposed = false;
    let timeout = null;

    // cleanup previous
    wrapperRef.current.innerHTML = "";
    try { widgetRef.current?.remove?.(); } catch {}
    widgetRef.current = null;
    setErrorSymbol(null);

    const tryCandidate = (idx = 0) => {
      if (disposed || !ordered[idx]) {
        // Ran out of providers
        if (forcedIdx != null && candidates[forcedIdx]) {
          setErrorSymbol(candidates[forcedIdx]);
        } else if (candidates.length) {
          setErrorSymbol(candidates[0]);
        }
        return;
      }
      const tvSymbol = ordered[idx];
      setTryingIdx(idx);

      // unique string id
      const mount = document.createElement("div");
      const id = `tv_chart_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      mount.id = id;
      mount.style.height = "560px";
      mount.style.width = "100%";
      wrapperRef.current.appendChild(mount);

      const w = new window.TradingView.widget({
        symbol: tvSymbol,
        container_id: id,
        autosize: true,
        interval: "60",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        details: true,
        calendar: true,
      });

      widgetRef.current = w;

      let chartReady = false;
      w.onChartReady?.(() => {
        if (disposed) return;
        chartReady = true;
        setLastGoodSymbol(tvSymbol);
        setTryingIdx(null);
        setErrorSymbol(null);
        // remove any older mounts
        Array.from(wrapperRef.current.children).forEach((child) => {
          if (child.id !== id) child.remove();
        });
      });

      // If not ready within 5000ms, try next (or show error if forced)
      timeout = window.setTimeout(() => {
        if (disposed) return;
        if (!chartReady) {
          try { w.remove?.(); } catch {}
          mount.remove();
          if (forcedIdx != null) {
            setTryingIdx(null);
            setErrorSymbol(tvSymbol); // present a clear error for the forced provider
          } else {
            tryCandidate(idx + 1);
          }
        }
      }, 5000);
    };

    tryCandidate(0);

    return () => {
      disposed = true;
      if (timeout) window.clearTimeout(timeout);
      try { widgetRef.current?.remove?.(); } catch {}
      widgetRef.current = null;
    };
  }, [ready, symbol, type, ordered, forcedIdx, candidates]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-neutral-300">
          <span className="font-medium text-white">{symbol}</span>
          {lastGoodSymbol && (
            <span className="ml-2 text-xs text-neutral-400">via {candidateLabel(lastGoodSymbol)}</span>
          )}
          {tryingIdx != null && ordered[tryingIdx] && (
            <span className="ml-2 text-xs text-amber-400">trying {candidateLabel(ordered[tryingIdx])}…</span>
          )}
        </div>
        {candidates.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400">Source</label>
            <select
              className="text-sm bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-200"
              value={forcedIdx ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                // force re-render with strict-single provider attempt
                setForcedIdx(Number.isFinite(v) ? v : null);
                setLastGoodSymbol(null);
                setTryingIdx(null);
                setErrorSymbol(null);
              }}
            >
              <option value="">Auto</option>
              {candidates.map((c, i) => (
                <option key={c} value={i}>{candidateLabel(c)} · {c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chart mount */}
      <div
        ref={wrapperRef}
        className="w-full h-[520px] rounded-lg overflow-hidden"
        style={{ background: "var(--background)" }}
      />

      {/* Loading overlay */}
      {!ready && (
        <div className="w-full h-[520px] flex items-center justify-center text-[color:var(--muted)]">
          Loading chart…
        </div>
      )}

      {/* Error overlay */}
      {ready && errorSymbol && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-white/10 bg-black/60 p-4 max-w-md text-center">
            <div className="text-sm text-neutral-200 mb-1">
              We couldn’t load <span className="font-semibold">{errorSymbol}</span> here.
            </div>
            <div className="text-xs text-neutral-400 mb-3">
              This can happen due to network/ad-block/CSP issues. You can:
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <a
                className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 text-sm"
                href={tvExternalLink(errorSymbol)}
                target="_blank"
                rel="noreferrer"
              >
                Open on TradingView
              </a>
              {candidates.length > 1 && forcedIdx == null && (
                <button
                  className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 text-sm"
                  onClick={() => {
                    // move to next candidate manually
                    const nextIdx = Math.min((tryingIdx ?? -1) + 1, candidates.length - 1);
                    setForcedIdx(nextIdx);
                    setLastGoodSymbol(null);
                    setTryingIdx(null);
                    setErrorSymbol(null);
                  }}
                >
                  Try next source
                </button>
              )}
            </div>
            <div className="text-[11px] text-neutral-500 mt-3">
              Allowlist: s3.tradingview.com, cdn.tradingview.com, widget.tradingview.com
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
