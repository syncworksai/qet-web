import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";

/* ---------- theme tokens ---------- */
function readCssVar(name) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function fallbackTokens() {
  return {
    accent: "#06b6d4",
    muted: "#94a3b8",
    grid: "#e5e7eb",
    success: "#10b981",
    danger: "#ef4444",
    warning: "#f59e0b",
  };
}
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function useTokens() {
  const [t, setT] = useState(fallbackTokens());
  useEffect(() => {
    const fb = fallbackTokens();
    setT({
      accent: readCssVar("--color-accent") || fb.accent,
      muted: readCssVar("--color-muted") || fb.muted,
      grid: readCssVar("--color-grid") || fb.grid,
      success: readCssVar("--color-success") || fb.success,
      danger: readCssVar("--color-danger") || fb.danger,
      warning: readCssVar("--color-warning") || fb.warning,
    });
  }, []);
  return t;
}

/* ---------- utils ---------- */
const toYMD = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfWeekMon = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

function toGoogleDateTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}
function buildGoogleCalUrl(evt) {
  const title = evt.title || evt.event || "Economic Event";
  const detailsParts = [];
  if (evt.country) detailsParts.push(`Country: ${evt.country}`);
  if (evt.importance) detailsParts.push(`Impact: ${evt.importance}`);
  if (evt.actual) detailsParts.push(`Actual: ${evt.actual}`);
  if (evt.forecast) detailsParts.push(`Forecast: ${evt.forecast}`);
  if (evt.previous) detailsParts.push(`Previous: ${evt.previous}`);
  const details = detailsParts.join("\n");
  const startIso = evt.datetime || evt.start || evt.date || evt.time;
  const endIso =
    evt.end ||
    new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
  const startStr = toGoogleDateTime(startIso);
  const endStr = toGoogleDateTime(endIso);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${startStr}/${endStr}`,
    details,
    ctz: "UTC",
  });
  if (evt.location) params.set("location", evt.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function downloadIcs(evt) {
  const title = (evt.title || evt.event || "Economic Event").replace(/\n/g, " ");
  const startIso = evt.datetime || evt.start || evt.date || evt.time;
  const endIso =
    evt.end ||
    new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QuantumEdge//EconomicCalendar//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${toGoogleDateTime(new Date().toISOString())}`,
    `DTSTART:${toGoogleDateTime(startIso)}`,
    `DTEND:${toGoogleDateTime(endIso)}`,
    `SUMMARY:${title}`,
  ];
  const detailsParts = [];
  if (evt.country) detailsParts.push(`Country: ${evt.country}`);
  if (evt.importance) detailsParts.push(`Impact: ${evt.importance}`);
  if (evt.actual) detailsParts.push(`Actual: ${evt.actual}`);
  if (evt.forecast) detailsParts.push(`Forecast: ${evt.forecast}`);
  if (evt.previous) detailsParts.push(`Previous: ${evt.previous}`);
  const description = detailsParts.join("\\n");
  if (description) lines.push(`DESCRIPTION:${description}`);
  if (evt.location) lines.push(`LOCATION:${evt.location}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Props:
 * - defaultView: "day" | "week" | "month" (default "week")
 * - compact: boolean
 */
export default function EconomicCalendar({ defaultView = "week", compact = true }) {
  const tokens = useTokens();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(today);
  const [view, setView] = useState(defaultView);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("ALL");
  const [impact, setImpact] = useState("ALL");

  const monthStart = useMemo(
    () => new Date(cursor.getFullYear(), cursor.getMonth(), 1),
    [cursor]
  );
  const monthEnd = useMemo(() => endOfMonth(cursor), [cursor]);

  const startStr = useMemo(
    () => toYMD(new Date(Date.UTC(monthStart.getFullYear(), monthStart.getMonth(), 1))),
    [monthStart]
  );
  const endStr = useMemo(
    () => toYMD(new Date(Date.UTC(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate()))),
    [monthEnd]
  );

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/calendar/`, {
        params: { start: startStr, end: endStr, country, impact },
      });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Calendar fetch failed", e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startStr, endStr, country, impact]);

  const matchCountry = (c) => country === "ALL" || (c || "").toUpperCase() === country;
  const matchImpact = (imp) => impact === "ALL" || (imp || "").toUpperCase() === impact.toUpperCase();

  const visibleDays = useMemo(() => {
    if (view === "day") return [new Date(cursor)];
    if (view === "week") {
      const start = startOfWeekMon(cursor);
      return [...Array(7)].map((_, i) => addDays(start, i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = endOfMonth(cursor);
    const firstWeekday = (first.getDay() + 6) % 7; // Mon start
    const days = [];
    for (let i = 0; i < firstWeekday; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    return days;
  }, [cursor, view]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    events.forEach((evt) => {
      const when = new Date(evt.datetime || evt.start || evt.date);
      const iso = toYMD(when);
      if (!matchCountry(evt.country)) return;
      if (!matchImpact(evt.importance)) return;
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso).push(evt);
    });
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.datetime || a.start || a.date) -
          new Date(b.datetime || b.start || b.date)
      );
    }
    return map;
  }, [events, country, impact]);

  const goPrev = () => {
    if (view === "day") setCursor(addDays(cursor, -1));
    else if (view === "week") setCursor(addDays(cursor, -7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (view === "day") setCursor(addDays(cursor, +1));
    else if (view === "week") setCursor(addDays(cursor, +7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  };
  const goToday = () => setCursor(new Date());

  const cellBase =
    view === "month"
      ? compact ? "h-28" : "h-32"
      : compact ? "h-36" : "h-48";

  const controlBorder = { border: `1px solid ${hexToRgba(tokens.grid, 0.6)}` };
  const selectStyle = {
    ...controlBorder,
    background: hexToRgba(tokens.accent, 0.06),
    color: tokens.accent,
  };

  const Badge = ({ imp }) => {
    const bg =
      imp === "HIGH"
        ? hexToRgba(tokens.danger, 0.15)
        : imp === "MEDIUM"
        ? hexToRgba(tokens.warning, 0.15)
        : hexToRgba(tokens.success, 0.15);
    const bd =
      imp === "HIGH"
        ? hexToRgba(tokens.danger, 0.35)
        : imp === "MEDIUM"
        ? hexToRgba(tokens.warning, 0.35)
        : hexToRgba(tokens.success, 0.35);
    const fg =
      imp === "HIGH" ? "#fecaca" : imp === "MEDIUM" ? "#fde68a" : "#bbf7d0";
    return (
      <span className="inline-block px-1.5 py-0.5 text-[10px] rounded border" style={{ background: bg, borderColor: bd, color: fg }}>
        {imp || "LOW"}
      </span>
    );
  };

  const EventCard = ({ evt }) => {
    const when = new Date(evt.datetime || evt.start || evt.date);
    const timeStr = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const gUrl = buildGoogleCalUrl(evt);
    const status = evt.released ? "Released" : "Upcoming";
    return (
      <div
        className="rounded-lg p-2 transition"
        style={{
          border: `1px solid ${hexToRgba(tokens.grid, 0.6)}`,
          background: hexToRgba(tokens.accent, 0.06),
        }}
      >
        <div className="text-[11px] flex items-center justify-between mb-1" style={{ color: tokens.muted }}>
          <span>{timeStr} · {(evt.country || "").toUpperCase()}</span>
          <Badge imp={(evt.importance || "").toUpperCase()} />
        </div>
        <div className="text-sm font-medium leading-snug">{evt.title || evt.event}</div>
        <div className="text-[11px] mt-0.5" style={{ color: tokens.muted }}>
          <span className="mr-2">{status}</span>
          {evt.actual ? <span className="mr-2">A: {evt.actual}</span> : null}
          {evt.forecast ? <span className="mr-2">F: {evt.forecast}</span> : null}
          {evt.previous ? <span className="mr-2">P: {evt.previous}</span> : null}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => downloadIcs(evt)}
            className="text-[11px] px-2 py-1 rounded"
            style={{ border: `1px dashed ${hexToRgba(tokens.grid, 0.7)}` }}
            title="Download .ics (Outlook / Apple)"
          >
            Export .ics
          </button>
          <a
            href={gUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] px-2 py-1 rounded"
            style={{
              background: tokens.accent,
              color: "black",
              border: `1px solid ${hexToRgba(tokens.accent, 0.35)}`,
            }}
            title="Add to Google Calendar"
          >
            Add to Google
          </a>
        </div>
      </div>
    );
  };

  return (
    <div
      className="rounded-xl p-4"
      style={{
        border: `1px solid ${hexToRgba(tokens.grid, 0.7)}`,
        background: hexToRgba(tokens.accent, 0.03), // <- never white
      }}
    >
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="px-2 py-1 rounded" style={controlBorder} title="Previous">←</button>
          <button onClick={goToday} className="px-2 py-1 rounded" style={controlBorder} title="Today">Today</button>
          <button onClick={goNext} className="px-2 py-1 rounded" style={controlBorder} title="Next">→</button>
          <div className="text-lg md:text-xl font-semibold ml-2">
            {view === "month"
              ? cursor.toLocaleString(undefined, { month: "long", year: "numeric" })
              : view === "week"
              ? `Week of ${startOfWeekMon(cursor).toLocaleDateString()}`
              : cursor.toLocaleDateString()}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded px-2 py-1" style={selectStyle} title="Filter by country">
            <option value="ALL">All Countries</option>
            <option value="US">US</option>
            <option value="EU">EU</option>
            <option value="GB">UK</option>
            <option value="JP">Japan</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
          </select>

          <select value={impact} onChange={(e) => setImpact(e.target.value)} className="rounded px-2 py-1" style={selectStyle} title="Filter by impact">
            <option value="ALL">All Impact</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>

          <div className="inline-flex rounded-xl overflow-hidden ml-1" style={controlBorder}>
            {["day", "week", "month"].map((v, i) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1 text-sm font-medium transition"
                style={{
                  background: view === v ? tokens.accent : "transparent",
                  color: view === v ? "black" : "white",
                  borderRight: i !== 2 ? `1px solid ${hexToRgba(tokens.grid, 0.6)}` : "none",
                }}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          <button onClick={fetchEvents} className="px-3 py-1 rounded" style={controlBorder} title="Refresh">
            Refresh
          </button>
        </div>
      </div>

      {/* Headers for week/month */}
      {(view === "week" || view === "month") && (
        <div className="grid grid-cols-7 text-center text-sm mb-2" style={{ color: tokens.muted }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <div key={w} className="py-1">{w}</div>
          ))}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="py-8 text-center" style={{ color: tokens.muted }}>Loading…</div>
      ) : view === "day" ? (
        <div className={`rounded-xl p-2 ${cellBase}`} style={{ border: `1px solid ${hexToRgba(tokens.grid, 0.6)}`, background: hexToRgba(tokens.accent, 0.04) }}>
          <div className="text-xs mb-1" style={{ color: tokens.muted }}>{cursor.toLocaleDateString()}</div>
          <div className="overflow-auto pr-1 space-y-2">
            {(eventsByDay.get(toYMD(cursor)) || []).map((evt, idx) => <EventCard key={idx} evt={evt} />)}
          </div>
        </div>
      ) : view === "week" ? (
        <div className="grid grid-cols-7 gap-2">
          {visibleDays.map((d, i) => (
            <div key={i} className={`rounded-xl p-2 flex flex-col ${cellBase}`} style={{ border: `1px solid ${hexToRgba(tokens.grid, 0.6)}`, background: hexToRgba(tokens.accent, 0.04) }}>
              <div className="text-xs mb-1" style={{ color: tokens.muted }}>{d.toLocaleDateString()}</div>
              <div className="flex-1 overflow-auto space-y-2 pr-1">
                {(eventsByDay.get(toYMD(d)) || []).map((evt, idx) => <EventCard key={idx} evt={evt} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // month
        <div className="grid grid-cols-7 gap-2">
          {visibleDays.map((d, i) =>
            d === null ? (
              <div key={`b-${i}`} className={`${cellBase} rounded-xl`} style={{ border: `1px dashed ${hexToRgba(tokens.grid, 0.4)}` }} />
            ) : (
              <div key={toYMD(d)} className={`${cellBase} rounded-xl p-2 flex flex-col`} style={{ border: `1px solid ${hexToRgba(tokens.grid, 0.6)}`, background: hexToRgba(tokens.accent, 0.04) }}>
                <div className="text-xs mb-1" style={{ color: tokens.muted }}>{d.getDate()}</div>
                <div className="flex-1 overflow-auto space-y-1 pr-1">
                  {(eventsByDay.get(toYMD(d)) || []).slice(0, 4).map((evt, idx) => <EventCard key={idx} evt={evt} />)}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
