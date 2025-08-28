// src/components/MarketStatus.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Minimal, robust market status/clock widget
 * - No external libs
 * - Uses correct Intl.DateTimeFormat options (weekday as string)
 * - Displays local time for each venue + open/closed badge
 * - Sessions are simple Mon–Fri; adjust as needed
 */

// Helper: get an object of local date parts in a given IANA timezone
function nowInTZParts(timeZone) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short", // ← string only (“Mon”, “Tue”, …)
  });
  const parts = dtf.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  // weekday is like "Mon", "Tue", ...
  const weekdayStr = map.weekday; // e.g., "Mon"
  // Compose a Date in that TZ by formatting to string; not needed here beyond display
  // Return useful numbers for comparisons
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  const hmsMinutes = hour * 60 + minute;
  return { map, weekdayStr, hour, minute, second, hmsMinutes };
}

// Helper: format the current time string for a tz
function timeStringInTZ(timeZone) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

// Parse "HH:MM" -> minutes since midnight
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return h * 60 + m;
}

// Market config: tweak times as you like
const MARKETS = [
  {
    key: "nyse",
    name: "New York (NYSE)",
    tz: "America/New_York",
    // Continuous session example (no lunch)
    sessions: [
      { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], open: "09:30", close: "16:00" },
    ],
  },
  {
    key: "london",
    name: "London (LSE)",
    tz: "Europe/London",
    sessions: [{ days: ["Mon", "Tue", "Wed", "Thu", "Fri"], open: "08:00", close: "16:30" }],
  },
  {
    key: "tokyo",
    name: "Tokyo (TSE)",
    tz: "Asia/Tokyo",
    // Simplified (TSE has lunch break in reality; you could model two sessions)
    sessions: [{ days: ["Mon", "Tue", "Wed", "Thu", "Fri"], open: "09:00", close: "15:00" }],
  },
  {
    key: "sydney",
    name: "Sydney (ASX)",
    tz: "Australia/Sydney",
    sessions: [{ days: ["Mon", "Tue", "Wed", "Thu", "Fri"], open: "10:00", close: "16:00" }],
  },
  {
    key: "forex",
    name: "FX (24×5)",
    tz: "Etc/UTC",
    // Model as “always open on weekdays” (simplified)
    sessions: [{ days: ["Mon", "Tue", "Wed", "Thu", "Fri"], open: "00:00", close: "24:00" }],
  },
];

// Returns { open: boolean, statusText: string, nextChange?: string }
function isOpenNow(market) {
  const { tz, sessions } = market;
  const { weekdayStr, hmsMinutes } = nowInTZParts(tz);

  // Find any session that matches today's weekday and current time
  let open = false;
  let withinSession = null;

  for (const s of sessions) {
    if (!s.days.includes(weekdayStr)) continue;
    const o = toMinutes(s.open);
    const c = toMinutes(s.close);
    if (hmsMinutes >= o && hmsMinutes < c) {
      open = true;
      withinSession = s;
      break;
    }
  }

  // Build status text + next change hint
  if (open) {
    const end = withinSession.close;
    return {
      open: true,
      statusText: `Open — closes ${end} (${tz})`,
    };
  } else {
    // Find next upcoming open today or on the next listed day
    // (Simple pass: today first, else next weekday in sessions)
    // This is a basic hint; for full accuracy you’d scan forward day by day.
    const todaySessions = sessions.filter((s) => s.days.includes(weekdayStr));
    if (todaySessions.length) {
      // Next open today if our time is before the open
      const nextToday = todaySessions
        .map((s) => ({ s, openMin: toMinutes(s.open) }))
        .filter(({ openMin }) => openMin > hmsMinutes)
        .sort((a, b) => a.openMin - b.openMin)[0];

      if (nextToday) {
        return {
          open: false,
          statusText: `Closed — opens today ${nextToday.s.open} (${tz})`,
        };
      }
    }
    // Otherwise, say “Closed” simply.
    return { open: false, statusText: "Closed" };
  }
}

function Badge({ open }) {
  return (
    <span
      className={[
        "inline-block px-2 py-0.5 text-[11px] rounded-full border",
        open
          ? "bg-green-500/20 text-green-300 border-green-400/40"
          : "bg-red-500/10 text-red-300 border-red-400/30",
      ].join(" ")}
    >
      {open ? "OPEN" : "CLOSED"}
    </span>
  );
}

export default function MarketStatus() {
  const [tick, setTick] = useState(0);

  // Update every second for live clocks
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Compute rows
  const rows = useMemo(() => {
    return MARKETS.map((m) => {
      const time = timeStringInTZ(m.tz);
      const state = isOpenNow(m);
      return { ...m, time, state };
    });
    // include `tick` so times refresh
  }, [tick]);

  return (
    <div className="bg-[color:var(--card)] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
          Market Status
        </div>
        <div className="text-xs text-[color:var(--muted)]">Live</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((m) => (
          <div
            key={m.key}
            className="rounded-xl border border-white/10 p-3 bg-[color:var(--bg)]"
            title={m.name}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">{m.name}</div>
              <Badge open={m.state.open} />
            </div>
            <div className="mt-1 text-[color:var(--muted)] text-sm">
              {m.tz}
            </div>
            <div className="mt-2 text-2xl font-mono tracking-wider">
              {m.time}
            </div>
            <div className="mt-1 text-sm opacity-80">{m.state.statusText}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
