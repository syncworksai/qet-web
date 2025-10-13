// src/components/TVLiteWidget.jsx
import React, { useEffect, useRef } from "react";

export default function TVLiteWidget({ symbol="XAUUSD", interval="60", theme="dark", height=400 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      theme,
      style: "1",
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      studies: ["BB@tv-basicstudies","MACD@tv-basicstudies","RSI@tv-basicstudies"],
      locale: "en",
    });
    ref.current.innerHTML = "";
    ref.current.appendChild(script);
  }, [symbol, interval, theme]);

  return (
    <div className="rounded-lg overflow-hidden border border-white/10" style={{ height }}>
      <div className="tradingview-widget-container" ref={ref} style={{ height: "100%" }} />
    </div>
  );
}
