// src/feeds/FeedHub.js
const listeners = new Map(); // symbol -> Set(fn)

export function publishTick(symbol, tick) {
  const set = listeners.get(symbol);
  if (!set) return;
  set.forEach(fn => fn(tick));
}

export function subscribeTicks(symbol, fn) {
  if (!listeners.has(symbol)) listeners.set(symbol, new Set());
  listeners.get(symbol).add(fn);
  return () => listeners.get(symbol)?.delete(fn);
}
