// src/components/TvWidget.jsx
import { useEffect, useRef } from "react";

export default function TvWidget({ symbol="OANDA:XAUUSD", interval="60", theme="dark", height=520 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.onload = () => {
      // global TradingView available
      new window.TradingView.widget({
        container_id: ref.current.id,
        symbol,                 // must be supported by TV
        interval,               // "1","5","15","60","240","1D"
        theme: theme === "dark" ? "dark" : "light",
        autosize: true,
        hide_legend: false,
        studies: ["RSI@tv-basicstudies","MACD@tv-basicstudies"],
        toolbar_bg: "rgba(0,0,0,0)",
        allow_symbol_change: true,
        locale: "en",
      });
    };
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, [symbol, interval, theme]);

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ height }}>
      <div id="tv_container" ref={ref} style={{ height: "100%", minHeight: height }} />
    </div>
  );
}
