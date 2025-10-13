// src/lib/syncBus.js
const listeners = {};
export function on(evt, fn) {
  (listeners[evt] ??= new Set()).add(fn);
  return () => listeners[evt]?.delete(fn);
}
export function emit(evt, payload) {
  if (payload == null) return;
  const set = listeners[evt];
  if (!set || set.size === 0) return;
  set.forEach((fn) => {
    try { fn(payload); } catch (e) { console.error(e); }
  });
}
