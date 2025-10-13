const API_BASE = window.__QE_API_BASE__ || location.origin;
function resToSec(res) { if (res === "1D") return 86400; const n = parseInt(res,10); return isNaN(n)?60:n*60; }

const DataFeed = {
  onReady: cb => setTimeout(() => cb({
    supports_search: true,
    supports_group_request: false,
    supports_marks: false,
    supports_timescale_marks: false,
    supports_time: true,
    supported_resolutions: ["1","5","10","15","30","60","240","1D"],
  }), 0),

  resolveSymbol: (symbol, onResolve, onError) => {
    const info = {
      name: symbol, full_name: symbol, ticker: symbol, description: symbol,
      type: "crypto", session: "24x7", timezone: "Etc/UTC",
      minmov: 1, pricescale: 100, has_intraday: true,
      supported_resolutions: ["1","5","10","15","30","60","240","1D"],
      volume_precision: 2, data_status: "streaming",
    };
    setTimeout(() => onResolve(info), 0);
  },

  getBars: async (symbolInfo, resolution, periodParams, onResult, onError) => {
    try {
      const sec = resToSec(resolution);
      const range = (sec >= 3600 ? "21d" : sec >= 900 ? "14d" : "7d");
      const r = await fetch(`${API_BASE}/api/market/ohlc/?symbol=${encodeURIComponent(symbolInfo.ticker)}&interval=${sec}&range=${range}`);
      const j = await r.json();
      const { t=[],o=[],h=[],l=[],c=[] } = j;
      const bars = t.map((ts,i)=>({ time: ts*1000, open:o[i], high:h[i], low:l[i], close:c[i], volume:0 }));
      onResult(bars, { noData: bars.length===0 });
    } catch(e) { onError(e?.message || "getBars failed"); }
  },

  subscribeBars: (symbolInfo, resolution, onTick, subscriberUID, onResetCacheNeeded) => {
    const sec = resToSec(resolution);
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/market`);
    ws.onopen = () => ws.send(JSON.stringify({ type:"subscribe", symbol: symbolInfo.ticker, intervals:[sec] }));
    ws.onmessage = ev => {
      try {
        const m = JSON.parse(ev.data || "{}");
        if (m.type === "bar" && m.symbol === symbolInfo.ticker && +m.interval === sec) {
          onTick({ time: m.t*1000, open:m.o, high:m.h, low:m.l, close:m.c, volume:m.v||0 });
        }
      } catch {}
    };
    ws.onerror = () => ws.close();
    (DataFeed._subs ||= {})[subscriberUID] = ws;
  },

  unsubscribeBars: (subscriberUID) => {
    const ws = DataFeed._subs && DataFeed._subs[subscriberUID];
    if (ws) { try { ws.close(); } catch{}; delete DataFeed._subs[subscriberUID]; }
  },
};

window.QE_TV_DATAFEED = DataFeed;
