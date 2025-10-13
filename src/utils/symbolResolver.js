// src/utils/symbolResolver.js
const upper = (s) => (s || "").toUpperCase().trim();

/**
 * Return an ordered list of TradingView-compatible symbols for a given input.
 * NOTE: We NEVER return `FX:` here to avoid the "only available on TradingView" popup.
 */
export function resolveTradingViewCandidates(symbol, assetType) {
  const s = upper(symbol);
  const t = upper(assetType);

  // Metals
  if (s === "XAUUSD" || s === "GOLD") {
    return ["OANDA:XAUUSD", "FOREXCOM:XAUUSD", "FX_IDC:XAUUSD", "TVC:GOLD"];
  }
  if (s === "XAGUSD" || s === "SILVER") {
    return ["OANDA:XAGUSD", "FOREXCOM:XAGUSD", "FX_IDC:XAGUSD", "TVC:SILVER"];
  }

  // Crypto
  if (t === "CRYPTO" || /BTC|ETH|SOL|XRP|DOGE|USDT|USDC/.test(s)) {
    return [`BINANCE:${s}`, `COINBASE:${s}`, `KRAKEN:${s}`, s];
  }

  // Forex pairs (6 letters)
  if (t === "FX" || t === "FOREX" || /^[A-Z]{6}$/.test(s)) {
    return [`OANDA:${s}`, `FOREXCOM:${s}`, `FX_IDC:${s}`, s];
  }

  // Indices
  const indexMap = {
    SPX: ["TVC:SPX"], NDX: ["TVC:NDX"], NAS100: ["TVC:NDX"],
    DJI: ["TVC:DJI"], DAX: ["XETR:DAX"], UK100: ["TVC:UKX"],
  };
  if (indexMap[s]) return [...indexMap[s], s];

  // Stocks (let TV resolve if not on NASDAQ/NYSE)
  if (t === "STOCK" || t === "EQUITY" || t === "STOCKS") {
    return [`NASDAQ:${s}`, `NYSE:${s}`, s];
  }

  return [s];
}

export function candidateLabel(tvSymbol) {
  const p = String(tvSymbol).split(":");
  return p.length > 1 ? p[0] : "Default";
}
