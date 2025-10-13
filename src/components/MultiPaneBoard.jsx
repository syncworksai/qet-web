// src/components/MultiPaneBoard.jsx
import React, { useEffect } from "react";
import ChartColumn from "./ChartColumn";
import { ORDERED_TF } from "../lib/timeframes";
import { startFeedTwelveData } from "../feeds";

export default function MultiPaneBoard({
  symbol = "XAUUSD",
  tfs = ORDERED_TF,
}) {
  useEffect(() => {
    // Start a single poller that publishes ticks for this symbol
    const stop = startFeedTwelveData([symbol]);
    return () => stop();
  }, [symbol]);

  return (
    <div style={{
      display: "grid",
      gridAutoFlow: "column",
      gridAutoColumns: "min-content",
      gap: 8,
      padding: 8,
      background: "#0b0f17"
    }}>
      {tfs.map(tf => (
        <ChartColumn key={tf} symbol={symbol} timeframe={tf} />
      ))}
    </div>
  );
}
