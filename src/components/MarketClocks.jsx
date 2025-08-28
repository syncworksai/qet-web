// src/components/MarketClocks.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Ultra-compact horizontal clocks row.
 * - One line, scrolls horizontally on small screens
 * - Simple open/closed session badge
 */
const MARKETS = [
  { key: "nyse",   name: "NYSE",   tz: "America/New_York", open: "09:30", close: "16:00", days: ["Mon","Tue","Wed","Thu","Fri"] },
  { key: "london", name: "LSE",    tz: "Europe/London",    open: "08:00", close: "16:30", days: ["Mon","Tue","Wed","Thu","Fri"] },
  { key: "tokyo",  name: "TSE",    tz: "Asia/Tokyo",       open: "09:00", close: "15:00", days: ["Mon","Tue","Wed","Thu","Fri"] },
  { key: "sydney", name: "ASX",    tz: "Australia/Sydney", open: "10:00", close: "16:00", days: ["Mon","Tue","Wed","Thu","Fri"] },
  { key: "forex",  name: "FX",     tz: "Etc/UTC",          open: "00:00", close: "24:00", days: ["Mon","Tue","Wed","Thu","Fri"] },
];

function nowParts(tz) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, weekday: "short",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date()).map(p => [p.type, p.value]));
  const weekday = parts.weekday;
  const h = Number(parts.hour), m = Number(parts.minute);
  return { time: `${parts.hour}:${parts.minute}:${parts.second}`, weekday, minutes: h*60 + m };
}
function toMin(hhmm) { const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
function isOpen({ tz, open, close, days }) {
  const { weekday, minutes } = nowParts(tz);
  if (!days.includes(weekday)) return false;
  const o = toMin(open), c = toMin(close);
  return minutes >= o && minutes < c;
}
function Badge({ open }) {
  return (
    <span className={[
      "ml-1 inline-block rounded-full px-1.5 py-[1px] text-[10px] leading-none border",
      open ? "bg-green-500/15 text-green-300 border-green-400/30"
           : "bg-red-500/10 text-red-300 border-red-400/30"
    ].join(" ")}>
      {open ? "OPEN" : "CLOSED"}
    </span>
  );
}

export default function MarketClocks() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 1000);
    return () => clearInterval(id);
  }, []);
  const rows = useMemo(() => {
    return MARKETS.map(m => ({ ...m, ...nowParts(m.tz), open: isOpen(m) }));
  }, [/* state tick re-renders each second */]);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max flex items-center gap-3 text-xs">
        {rows.map(m => (
          <div
            key={m.key}
            className="flex items-center gap-2 px-2 py-1 rounded border border-white/10 bg-[color:var(--card)]"
            title={m.tz}
          >
            <span className="font-semibold">{m.name}</span>
            <span className="font-mono opacity-80">{m.time}</span>
            <Badge open={m.open} />
          </div>
        ))}
      </div>
    </div>
  );
}
