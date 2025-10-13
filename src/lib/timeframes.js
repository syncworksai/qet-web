// src/lib/timeframes.js
export const TF = {
  "1m": 60,
  "5m": 300,
  "10m": 600,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
};

export const ORDERED_TF = ["1m", "5m", "10m", "15m", "30m", "1h"];

export function tfSeconds(tf) { return TF[tf]; }

export function barCloseCountdown(nowSec, barOpenSec, tfSec) {
  const nextClose = barOpenSec + tfSec;
  return Math.max(0, nextClose - nowSec);
}
