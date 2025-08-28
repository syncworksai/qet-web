// src/pages/Journal.jsx
import React from "react";
import JournalPanel from "../components/JournalPanel";

export default function Journal() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-100">Journal</h1>
      <p className="text-neutral-400 mt-1">
        Reflect on your trades or write general notes. Add tags, mood, and photos.
      </p>

      <div className="mt-4 max-w-4xl">
        <JournalPanel />
      </div>
    </div>
  );
}
