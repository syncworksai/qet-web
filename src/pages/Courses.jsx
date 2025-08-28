// src/pages/Courses.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function Courses() {
  const card =
    "rounded-2xl border border-neutral-800 p-4 bg-[color:var(--card,#0B0B10)]";
  const ghostBtn =
    "mt-3 px-3 py-2 rounded-xl bg-neutral-800 text-neutral-200 border border-neutral-700 cursor-not-allowed";

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-100">Advanced Courses</h1>
      <p className="text-neutral-400 mt-1">
        We’re lining up tutorials and deep dives. Add requests and we’ll prioritize.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className={card}>
          <h3 className="text-neutral-100 font-medium">Fibonacci Retracements</h3>
          <p className="text-neutral-400 text-sm mt-1">Identify swing points, confluence, and risk placement.</p>
          <button className={ghostBtn}>Coming soon</button>
        </div>

        <div className={card}>
          <h3 className="text-neutral-100 font-medium">Momentum & Breakout Filters</h3>
          <p className="text-neutral-400 text-sm mt-1">Session timing, volume, and volatility regimes.</p>
          <button className={ghostBtn}>Coming soon</button>
        </div>

        <div className={card}>
          <h3 className="text-neutral-100 font-medium">Indicator Playbooks</h3>
          <p className="text-neutral-400 text-sm mt-1">EMA, RSI, ATR, and confluence with price action.</p>
          <button className={ghostBtn}>Coming soon</button>
        </div>
      </div>

      <div className="mt-6 text-sm text-neutral-400">
        Want tailored learning?{" "}
        <Link to="/psych-quiz" className="text-indigo-400 hover:text-indigo-300">
          Take the Psych Quiz
        </Link>{" "}
        and we’ll suggest modules that fit your profile.
      </div>
    </div>
  );
}
