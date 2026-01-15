"use client";

import { useState, useEffect } from "react";
import { Filter, ArrowLeft, ArrowRight } from "lucide-react";

type ChartFiltersProps = {
  headerRef: React.RefObject<HTMLDivElement>;
  symbols?: string[];
  timeframes?: string[];
  activeTab?: "LONG" | "SHORT";
  selectedTimeframe?: "5m" | "1h" | "8h" | "1D" | "1W";
  onTimeframeChange?: (tf: "5m" | "1h" | "8h" | "1D" | "1W") => void;
  onTabChange?: (tab: "LONG" | "SHORT") => void;
};

export function ChartFilters({
  headerRef,
  symbols = [],
  timeframes = ["5m", "1h", "8h", "1D", "1W"],
  activeTab = "LONG",
  selectedTimeframe = "8h",
  onTimeframeChange,
  onTabChange,
}: ChartFiltersProps) {
  const [sideOpen, setSideOpen] = useState(false);
  const [filtersStuck, setFiltersStuck] = useState(false);

  // Detect when filters should become sticky using IntersectionObserver
  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setFiltersStuck(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [headerRef]);

  if (!filtersStuck) return null;

  return (
    <>
      <button
        aria-label="Open filters"
        onClick={() => setSideOpen((v) => !v)}
        className="fixed left-2 top-1/2 -translate-y-1/2 z-40 rounded-xl bg-black text-white px-3 py-2 shadow-lg hover:bg-black/90 flex flex-col items-center gap-1 transition-all"
      >
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] flex items-center justify-center shadow">
          {sideOpen ? <ArrowLeft className="w-3 h-3 text-slate-900" /> : <ArrowRight className="w-3 h-3 text-slate-900" />}
        </span>
        <span className="mt-1 text-[10px] [writing-mode:vertical-rl] rotate-180 tracking-wider">FILTERS</span>
        <Filter className="w-4 h-4 text-white opacity-90" />
      </button>

      <div
        className={`fixed left-4 top-24 z-40 w-72 max-w-[85vw] rounded-2xl ring-1 ring-slate-200 bg-white/95 backdrop-blur shadow-xl transition-transform duration-300 ${
          sideOpen ? "translate-x-0" : "-translate-x-[110%]"
        }`}
      >
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Filters</div>
          <button
            onClick={() => setSideOpen(false)}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>
        <div className="p-3 space-y-3 text-sm">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Timeframe</div>
            <div className="flex flex-wrap items-center gap-1 rounded-xl ring-1 ring-slate-200 bg-white p-1">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => onTimeframeChange?.(tf as "5m" | "1h" | "8h" | "1D" | "1W")}
                  className={`px-2.5 py-1 rounded-lg text-xs ${
                    selectedTimeframe === tf
                      ? "bg-black text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Side</div>
            <div className="flex items-center gap-1 rounded-xl ring-1 ring-slate-200 bg-white p-1">
              {["LONG", "SHORT"].map((s) => (
                <button
                  key={s}
                  onClick={() => onTabChange?.(s as "LONG" | "SHORT")}
                  className={`px-2.5 py-1 rounded-lg text-xs ${
                    activeTab === s
                      ? "bg-black text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {symbols.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              <label className="text-[11px] uppercase tracking-wide text-slate-500">
                Symbol
                <select className="mt-1 w-full h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700">
                  <option value="all">All Symbols</option>
                  {symbols.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Price Range</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min"
                className="h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700"
              />
              <input
                type="number"
                placeholder="Max"
                className="h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700"
              />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Position Size</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min"
                className="h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700"
              />
              <input
                type="number"
                placeholder="Max"
                className="h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

