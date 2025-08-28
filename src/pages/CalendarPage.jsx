// src/pages/CalendarPage.jsx
import React from "react";
import EconomicCalendar from "../components/EconomicCalendar";

export default function CalendarPage() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Economic Calendar
        </h1>
        <p className="text-sm text-[color:var(--muted)]">
          Upcoming macro events (powered by Trading Economics guest feed). Filter by country,
          importance, or date.
        </p>
      </div>

      <EconomicCalendar />
    </div>
  );
}
