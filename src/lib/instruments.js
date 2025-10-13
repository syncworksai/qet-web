// src/lib/instruments.js
export function specFor(symbol) {
  const s = String(symbol || "").toUpperCase();
  // Metals: $1 per point (e.g., 1965.10 -> 1966.10 = +$1)
  if (s === "XAUUSD" || s === "XAGUSD") {
    return { mode: "point", pointSize: 1, valuePerPoint: 1.0 };
  }
  // FX major: $0.01 per pip, pip=0.0001 (JPY pairs pip=0.01)
  const jpy = /JPY$/.test(s);
  return { mode: "pip", pipSize: jpy ? 0.01 : 0.0001, valuePerPip: 0.01 };
}
