// src/components/ForexCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";

const toYMD = (d) => d.toISOString().slice(0, 10);
const startOfWeekMon = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const IMPACT_CLASS = {
  LOW: "bg-green-500/15 text-green-300 border-green-400/30",
  MEDIUM: "bg-yellow-500/15 text-yellow-300 border-yellow-400/30",
  HIGH: "bg-red-500/15 text-red-300 border-red-400/30",
};

export default function ForexCalendar({ defaultView = "week", compact = true }) {
  const [view, setView] = useState(defaultView);
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ok | empty | error
  const [country, setCountry] = useState("ALL");
  const [impact, setImpact] = useState("ALL");

  const range = useMemo(() => {
    if (view === "day") {
      const d = new Date(cursor);
      return { start: toYMD(d), end: toYMD(d) };
    }
    if (view === "week") {
      const start = startOfWeekMon(cursor);
      const end = addDays(start, 6);
      return { start: toYMD(start), end: toYMD(end) };
    }
    // month
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return { start: toYMD(first), end: toYMD(last) };
  }, [cursor, view]);

  const fetchEvents = async () => {
    setStatus("loading");
    try {
      const params = {
        start: range.start,
        end: range.end,
        country,
        impact,
      };
      // Strong hint to show "something today/week"
      if (view === "day") params.today_only = 1;

      const res = await api.get("/api/calendar/", { params });
      const data = Array.isArray(res.data) ? res.data : [];
      if (!data.length) {
        setEvents([]);
        setStatus("empty");
      } else {
        // Sort by time ascending
        data.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        setEvents(data);
        setStatus("ok");
      }
    } catch (e) {
      console.error("ForexCalendar fetch failed:", e);
      setEvents([]);
      setStatus("error");
    }
  };

  useEffect(() => { fetchEvents(); /* eslint-disable-next-line */ }, [range.start, range.end, country, impact]);

  const goPrev = () => setCursor(prev =>
    view === "day" ? addDays(prev, -1) :
    view === "week" ? addDays(prev, -7) :
    new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
  );
  const goNext = () => setCursor(prev =>
    view === "day" ? addDays(prev, +1) :
    view === "week" ? addDays(prev, +7) :
    new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
  );
  const goToday = () => setCursor(new Date());

  const ImpactBadge = ({ imp }) => (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded border ${IMPACT_CLASS[imp || "LOW"] || IMPACT_CLASS.LOW}`}>
      {imp || "LOW"}
    </span>
  );

  const EventRow = ({ e }) => {
    const when = e.datetime ? new Date(e.datetime) : null;
    const t = when ? when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    return (
      <div className="flex items-center justify-between gap-2 py-2 px-2 rounded-lg hover:bg-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <ImpactBadge imp={(e.importance || "").toUpperCase()} />
          <div className="text-xs opacity-80 w-16 shrink-0">{t}</div>
          <div className="truncate">
            <div className="text-sm font-medium truncate">{e.title || "Economic Event"}</div>
            <div className="text-[11px] opacity-70">
              {(e.country || "").toUpperCase()}
              {e.forecast ? <> · F {String(e.forecast)}</> : null}
              {e.previous ? <> · P {String(e.previous)}</> : null}
              {e.actual ? <> · A {String(e.actual)}</> : null}
            </div>
          </div>
        </div>
        {/* We keep it simple: no deep links; FF link is in toolbar */}
      </div>
    );
  };

  return (
    <div className="rounded-2xl p-4 border border-white/10 bg-[color:var(--card)]">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="px-2 py-1 rounded border border-white/10 hover:border-white/20">←</button>
          <button onClick={goToday} className="px-2 py-1 rounded border border-white/10 hover:border-white/20">Today</button>
          <button onClick={goNext} className="px-2 py-1 rounded border border-white/10 hover:border-white/20">→</button>
          <div className="ml-2 text-sm md:text-base font-semibold">
            {view === "day"
              ? cursor.toLocaleDateString()
              : view === "week"
              ? `Week of ${startOfWeekMon(cursor).toLocaleDateString()}`
              : cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded px-2 py-1 bg-background border border-white/10"
            title="Filter by country"
          >
            <option value="ALL">All</option>
            <option value="US">US</option>
            <option value="EU">EU</option>
            <option value="GB">UK</option>
            <option value="JP">Japan</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
          </select>
          <select
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            className="rounded px-2 py-1 bg-background border border-white/10"
            title="Filter by impact"
          >
            <option value="ALL">All impact</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>

          <div className="inline-flex rounded-xl border border-white/10 overflow-hidden">
            {["day","week","month"].map((v, i) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  "px-3 py-1 text-sm font-medium transition",
                  view === v ? "bg-[color:var(--accent)] text-black" : "bg-[color:var(--card)] text-white hover:bg-white/5",
                  i !== 2 ? "border-r border-white/10" : "",
                ].join(" ")}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          <a
            href="https://www.forexfactory.com/calendar"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1 rounded border border-[color:var(--accent)]/60 hover:bg-[color:var(--accent)] hover:text-black"
            title="Open ForexFactory Calendar"
          >
            ForexFactory
          </a>

          <button
            onClick={fetchEvents}
            className="px-3 py-1 rounded border border-white/10 hover:border-white/20"
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      {status === "loading" && <div className="text-[color:var(--muted)] py-4">Loading…</div>}
      {status === "error" && <div className="text-[color:var(--muted)] py-4">Calendar unavailable.</div>}
      {status === "empty" && <div className="text-[color:var(--muted)] py-4">No events found for the selected range.</div>}

      {status === "ok" && (
        <div className="divide-y divide-white/10">
          {events.map((e, i) => <EventRow key={i} e={e} />)}
        </div>
      )}
    </div>
  );
}
