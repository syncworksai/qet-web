// src/lib/candleBuilder.js
import { tfSeconds } from "./timeframes";

export function CandleBuilder(tf) {
  const tfSec = tfSeconds(tf);
  let bar = null;
  const bars = [];

  function feedTick({ price, ts }) {
    const t = Math.floor(ts);
    const bucket = t - (t % tfSec);
    if (!bar || bar.t !== bucket) {
      if (bar) bars.push(bar);
      bar = { t: bucket, open: price, high: price, low: price, close: price };
    } else {
      bar.high = Math.max(bar.high, price);
      bar.low  = Math.min(bar.low, price);
      bar.close = price;
    }
    return { bar, bars };
  }

  function toLightweight() {
    return bars.map(b => ({
      time: b.t,
      open: b.open, high: b.high, low: b.low, close: b.close,
    }));
  }

  return { feedTick, toLightweight, get bars() { return bars; }, get current() { return bar; } };
}
