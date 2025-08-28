// src/lib/backtest.js

// Safe number
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Minimal CSV parser (no deps). Handles quoted fields and commas.
// Assumes first line is header.
export function parseCSV(text) {
  // Split into lines
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim() !== "");
  if (lines.length === 0) return { header: [], rows: [] };

  // Tokenize a CSV line
  function tokenize(line) {
    const out = [];
    let i = 0, cur = "", inQ = false;
    while (i < line.length) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        } else { cur += ch; i++; continue; }
      } else {
        if (ch === '"') { inQ = true; i++; continue; }
        if (ch === ",") { out.push(cur); cur = ""; i++; continue; }
        cur += ch; i++;
      }
    }
    out.push(cur);
    return out;
  }

  const header = tokenize(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const t = tokenize(line);
    const obj = {};
    header.forEach((h, idx) => obj[h] = t[idx] ?? "");
    return obj;
  });
  return { header, rows };
}

// Normalize one row into a trade record the simulator understands
export function normalizeRow(row) {
  // commonly used columns (case-insensitive)
  const map = {};
  for (const [k, v] of Object.entries(row)) map[k.toLowerCase()] = v;

  const date = map["date"] || map["timestamp"] || map["closed_at"] || map["time"] || "";
  const symbol = (map["symbol"] || map["ticker"] || "").toUpperCase();
  const direction = (map["direction"] || map["side"] || "long").toLowerCase(); // long/short/buy/sell
  const entry = num(map["entry_price"] ?? map["entry"] ?? map["open"] ?? map["avg_entry"]);
  const exit = num(map["exit_price"] ?? map["exit"] ?? map["close"] ?? map["avg_exit"]);
  const size = num(map["size"] ?? map["qty"] ?? map["quantity"] ?? map["contracts"]);
  const fees = num(map["fees"] ?? map["commission"] ?? 0);

  // normalize direction synonyms
  const dir = direction === "sell" || direction === "short" ? "short" : "long";

  return {
    date: date ? new Date(date) : null,
    symbol,
    direction: dir,          // "long" | "short"
    entry_price: entry,      // number
    exit_price: exit,        // number
    size,                    // number
    fees: fees ?? 0,         // number
  };
}

// Compute pnl for a normalized trade
export function computePnL(t) {
  if (t.entry_price == null || t.exit_price == null || t.size == null) return null;
  const delta = (t.exit_price - t.entry_price) * (t.direction === "short" ? -1 : 1);
  const gross = delta * t.size;
  const net = gross - (t.fees ?? 0);
  return net;
}

// Aggregate stats + equity curve (ordered by date, then index)
export function simulate(trades) {
  const clean = trades
    .map((t, idx) => ({ ...t, _idx: idx }))
    .filter(t => t.entry_price != null && t.exit_price != null && t.size != null && t.date instanceof Date && !Number.isNaN(t.date.getTime()));

  clean.sort((a, b) => a.date - b.date || a._idx - b._idx);

  const equity = [];
  let cum = 0;
  let wins = 0, losses = 0, sumWin = 0, sumLoss = 0;

  for (const t of clean) {
    const pnl = computePnL(t) ?? 0;
    cum += pnl;
    equity.push({ time: Math.floor(t.date.getTime() / 1000), value: cum }); // lightweight-charts wants unix seconds
    if (pnl > 0) { wins++; sumWin += pnl; }
    else if (pnl < 0) { losses++; sumLoss += pnl; }
  }

  const total = clean.length;
  const winRate = total ? (wins / total) * 100 : 0;

  // Expectancy = (Pwin * AvgWin) + (Ploss * AvgLoss)
  const avgWin = wins ? sumWin / wins : 0;
  const avgLoss = losses ? sumLoss / losses : 0; // negative
  const pWin = total ? wins / total : 0;
  const pLoss = total ? losses / total : 0;
  const expectancy = pWin * avgWin + pLoss * avgLoss;

  // Max drawdown
  let peak = 0, maxDD = 0, last = 0;
  for (const p of equity) {
    last = p.value;
    if (last > peak) peak = last;
    const dd = peak - last;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    total,
    wins,
    losses,
    winRate,
    pnl: last,
    avgWin,
    avgLoss,
    expectancy,
    maxDrawdown: maxDD,
    equity,
    normalizedTrades: clean,
  };
}
