import React from "react";
import MultiChartGrid from "../components/MultiChartGrid";

export default function ProDesk() {
  return (
    <div className="h-[calc(100vh-56px)] w-full bg-[#0b0f17] text-[#c9d5e2]">
      <div className="h-14 border-b border-white/10 flex items-center px-4 justify-between bg-[#0c121b]">
        <div className="font-semibold">Quantum Edge • Pro Charts</div>
        <div className="text-xs opacity-70">Realtime via Finnhub (dev)</div>
      </div>
      <MultiChartGrid />
    </div>
  );
}
