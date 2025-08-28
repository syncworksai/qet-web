// src/components/ChartCard.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * Normalize our internal {symbol, asset_type} to a TradingView symbol.
 * - Stocks: try raw symbol (AAPL)
 * - Forex: FX:<PAIR> (e.g., FX:EURUSD)
 * - Crypto: BINANCE:<PAIR> (assume USDT when only base given)
 * - Commodity: try OANDA:<SYMBOL> (e.g., OANDA:XAUUSD, OANDA:XTIUSD for WTI)
 * - Index: TVC:<SYMBOL> (e.g., TVC:GOLD, TVC:SPX, TVC:NDX)
 */
function toTradingViewSymbol({ symbol, asset_type }) {
  if (!symbol) return "AAPL";
  const clean = symbol.replace(/\s+/g, "").toUpperCase();

  if (asset_type === "forex") {
    return `FX:${clean}`;
  }

  if (asset_type === "crypto") {
    if (/^[A-Z]{2,6}$/.test(clean)) return `BINANCE:${clean}USDT`;
    return `BINANCE:${clean}`;
  }

  if (asset_type === "commodity") {
    // Use OANDA provider symbols where possible (XAUUSD, XAGUSD, XTIUSD, XBRUSD)
    return `OANDA:${clean}`;
  }

  if (asset_type === "index") {
    // TVC has many indices (SPX, NDX, DJI, DAX, FTSE, etc.)
    return `TVC:${clean}`;
  }

  // default stocks
  return clean;
}

export default function ChartCard({ active }) {
  const containerRef = useRef(null);
  const scriptRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(!!window.TradingView);

  const tvSymbol = toTradingViewSymbol(active || { symbol: "AAPL", asset_type: "stock" });

  // Load TradingView script once
  useEffect(() => {
    if (window.TradingView) {
      setScriptReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.onload = () => setScriptReady(true);
    scriptRef.current = s;
    document.body.appendChild(s);

    return () => {
      scriptRef.current = null;
    };
  }, []);

  // (Re)build widget whenever symbol changes and script is ready
  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.TradingView) return;
    containerRef.current.innerHTML = "";

    /* global TradingView */
    new window.TradingView.widget({
      symbol: tvSymbol,
      autosize: true,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      container_id: "tv_chart_container",
    });
  }, [scriptReady, tvSymbol]);

  return (
    <div className="w-full h-[520px] rounded-lg overflow-hidden" style={{ background: "var(--background)" }}>
      <div id="tv_chart_container" ref={containerRef} className="w-full h-full" />
      {!scriptReady && (
        <div className="w-full h-full flex items-center justify-center text-[color:var(--muted)]">
          Loading chart…
        </div>
      )}
    </div>
  );
}
