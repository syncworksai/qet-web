import React, { useMemo, useState } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useRealtimeFeed } from "../hooks/useRealtimeFeed";
import ProPaneChart from "./ProPaneChart";

const defaultSymbols = ["XAUUSD", "EURUSD", "US30", "XAGUSD"];

function Cell({ symbol, timeframe }) {
  const { candles, status } = useRealtimeFeed(symbol, timeframe);
  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0b0f17]">
      {status === "error" ? (
        <div className="p-4 text-red-400 text-sm">Feed error</div>
      ) : (
        <ProPaneChart id={`${symbol}-${timeframe}`} candles={candles} symbol={symbol} timeframe={timeframe} />
      )}
    </div>
  );
}

export default function MultiChartGrid() {
  const [symbols, setSymbols] = useState(defaultSymbols);
  const [timeframe, setTimeframe] = useState("1h");

  const layout = useMemo(() => {
    const l = [];
    for (let i = 0; i < Math.min(4, symbols.length); i++) {
      l.push({ i: symbols[i], x:(i%2)*6, y:Math.floor(i/2)*9, w:6, h:9, minW:4, minH:7 });
    }
    return l;
  }, [symbols]);

  const add = (s) => {
    s = s.trim().toUpperCase();
    if (s && !symbols.includes(s)) setSymbols([...symbols, s]);
  };
  const remove = (s) => setSymbols(symbols.filter(x => x !== s));

  return (
    <div className="flex h-full">
      {/* Left tools */}
      <aside className="w-56 shrink-0 border-r border-white/10">
        <div className="p-3 text-sm font-semibold">Watchlist</div>
        <div className="px-3 pb-2">
          <form onSubmit={e=>{ e.preventDefault(); add(e.target.t.value); e.target.reset(); }}>
            <input name="t" placeholder="Add symbol (e.g. XAUUSD)"
              className="w-full mb-2 text-xs bg-black/40 border border-white/10 rounded-md px-2 py-1 outline-none"/>
          </form>
          <div className="space-y-1">
            {symbols.map(s=>(
              <div key={s} className="flex items-center justify-between text-xs bg-white/5 rounded-md px-2 py-1">
                <span>{s}</span>
                <button onClick={()=>remove(s)} className="opacity-60 hover:opacity-100">✕</button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 border-t border-white/10">
          <div className="text-sm font-semibold mb-2">Timeframe</div>
          <div className="grid grid-cols-3 gap-2">
            {["1m","5m","15m","1h","4h","1D"].map(tf=>(
              <button key={tf} onClick={()=>setTimeframe(tf)}
                className={`text-xs px-2 py-1 rounded-md border ${timeframe===tf ? "bg-white/15":"bg-white/5"} border-white/10`}>
                {tf}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Grid */}
      <div className="flex-1 p-3 overflow-auto">
        <GridLayout className="layout" layout={layout} cols={12} rowHeight={14} width={1200}
          isDraggable isResizable compactType="vertical" margin={[12,12]}>
          {layout.map(cell => (
            <div key={cell.i}>
              <Cell symbol={cell.i} timeframe={timeframe} />
            </div>
          ))}
        </GridLayout>
      </div>

      {/* Right stub to mirror your screenshot */}
      <aside className="w-72 shrink-0 border-l border-white/10 hidden xl:block">
        <div className="p-3 text-sm font-semibold">Order Ticket (stub)</div>
        <div className="p-3 text-xs opacity-70">
          Wire to TradeLocker/prop API later. This is a placeholder to match layout.
        </div>
      </aside>
    </div>
  );
}
