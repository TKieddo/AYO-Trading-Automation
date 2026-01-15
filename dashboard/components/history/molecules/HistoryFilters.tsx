"use client";

import { Button } from "@/components/ui/button";
import { Download, Filter, ArrowLeft, ArrowRight } from "lucide-react";
import { RangeKey, SideFilter, StatusFilter, TypeFilter } from "../hooks/useHistoryState";

type TopFiltersProps = {
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  filterSide: SideFilter;
  setFilterSide: (v: SideFilter) => void;
  filterSymbol: string;
  setFilterSymbol: (v: string) => void;
  filterType: TypeFilter;
  setFilterType: (v: TypeFilter) => void;
  filterStatus: StatusFilter;
  setFilterStatus: (v: StatusFilter) => void;
  symbols: string[];
  onExport: (kind: "trades" | "orders") => void;
  headerRef: React.RefObject<HTMLDivElement>;
};

export function TopFilters({
  range,
  setRange,
  filterSide,
  setFilterSide,
  filterSymbol,
  setFilterSymbol,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  symbols,
  onExport,
  headerRef,
}: TopFiltersProps) {
  return (
    <div ref={headerRef} className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-3 min-w-0">
        <div className="flex items-center gap-2 w-full max-w-[720px] px-2 py-2 rounded-2xl ml-auto justify-end">
          <div className="flex items-center gap-1 rounded-xl ring-1 ring-slate-200 bg-white p-1">
            {["7d", "30d", "90d", "1y", "all"].map(r => (
              <button key={r} onClick={() => setRange(r as RangeKey)} className={`px-2.5 py-1 rounded-lg text-xs ${range === r ? "bg-black text-white" : "text-slate-700 hover:bg-slate-50"}`}>{r.toUpperCase()}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl ring-1 ring-slate-200 bg-white p-1">
              {["all", "buy", "sell"].map(s => (
                <button key={s} onClick={() => setFilterSide(s as SideFilter)} className={`px-2.5 py-1 rounded-lg text-xs ${filterSide === s ? "bg-black text-white" : "text-slate-700 hover:bg-slate-50"}`}>{s.toUpperCase()}</button>
              ))}
            </div>
            <select value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)} className="h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700">
              <option value="all">All Symbols</option>
              {symbols.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value as TypeFilter)} className="h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700">
              <option value="all">All Types</option>
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)} className="h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700">
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="filled">Filled</option>
              <option value="canceled">Canceled</option>
              <option value="rejected">Rejected</option>
              <option value="triggered">Triggered</option>
            </select>
          </div>
          <Button onClick={() => onExport("trades")} className="bg-black text-white hover:bg-black/90"><Download className="w-4 h-4 mr-2" />Export Trades</Button>
          <Button onClick={() => onExport("orders")} className="bg-black text-white hover:bg-black/90"><Download className="w-4 h-4 mr-2" />Export Orders</Button>
        </div>
      </div>
      <div className="min-w-0 max-w-[640px]">
        <div className="text-2xl font-semibold text-slate-800">History</div>
        <div className="text-slate-500 text-sm">All trades, orders, and PnL across time</div>
      </div>
    </div>
  );
}

type StickyFiltersProps = {
  visible: boolean;
  sideOpen: boolean;
  setSideOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  filterSide: SideFilter;
  setFilterSide: (v: SideFilter) => void;
  filterSymbol: string;
  setFilterSymbol: (v: string) => void;
  filterType: TypeFilter;
  setFilterType: (v: TypeFilter) => void;
  filterStatus: StatusFilter;
  setFilterStatus: (v: StatusFilter) => void;
  symbols: string[];
  onExport: (kind: "trades" | "orders") => void;
};

export function StickyFilters({ visible, sideOpen, setSideOpen, range, setRange, filterSide, setFilterSide, filterSymbol, setFilterSymbol, filterType, setFilterType, filterStatus, setFilterStatus, symbols, onExport }: StickyFiltersProps) {
  if (!visible) return null;
  return (
    <>
      <button
        aria-label="Open filters"
        onClick={() => setSideOpen(v => !v)}
        className="fixed left-2 top-1/2 -translate-y-1/2 z-40 rounded-xl bg-black text-white px-3 py-2 shadow-lg hover:bg-black/90 flex flex-col items-center gap-1"
      >
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] flex items-center justify-center shadow">
          {sideOpen ? <ArrowLeft className="w-3 h-3 text-slate-900" /> : <ArrowRight className="w-3 h-3 text-slate-900" />}
        </span>
        <span className="mt-1 text-[10px] [writing-mode:vertical-rl] rotate-180 tracking-wider">FILTERS</span>
        <Filter className="w-4 h-4 text-white opacity-90" />
      </button>

      <div className={`fixed left-4 top-24 z-40 w-72 max-w-[85vw] rounded-2xl ring-1 ring-slate-200 bg-white/95 backdrop-blur shadow-xl transition-transform ${sideOpen ? "translate-x-0" : "-translate-x-[110%]"} `}>
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Filters</div>
          <button onClick={() => setSideOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">Close</button>
        </div>
        <div className="p-3 space-y-3 text-sm">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Date Range</div>
            <div className="flex flex-wrap items-center gap-1 rounded-xl ring-1 ring-slate-200 bg-white p-1">
              {["7d", "30d", "90d", "1y", "all"].map(r => (
                <button key={r} onClick={() => setRange(r as RangeKey)} className={`px-2.5 py-1 rounded-lg text-xs ${range === r ? "bg-black text-white" : "text-slate-700 hover:bg-slate-50"}`}>{r.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Side</div>
            <div className="flex items-center gap-1 rounded-xl ring-1 ring-slate-200 bg-white p-1">
              {["all", "buy", "sell"].map(s => (
                <button key={s} onClick={() => setFilterSide(s as SideFilter)} className={`px-2.5 py-1 rounded-lg text-xs ${filterSide === s ? "bg-black text-white" : "text-slate-700 hover:bg-slate-50"}`}>{s.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <label className="text-[11px] uppercase tracking-wide text-slate-500">Symbol
              <select value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)} className="mt-1 w-full h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700">
                <option value="all">All Symbols</option>
                {symbols.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] uppercase tracking-wide text-slate-500">Type
              <select value={filterType} onChange={e => setFilterType(e.target.value as TypeFilter)} className="mt-1 w-full h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700">
                <option value="all">All Types</option>
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </label>
            <label className="text-[11px] uppercase tracking-wide text-slate-500">Status
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)} className="mt-1 w-full h-8 text-xs rounded-lg ring-1 ring-slate-200 bg-white px-2 text-slate-700">
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="filled">Filled</option>
                <option value="canceled">Canceled</option>
                <option value="rejected">Rejected</option>
                <option value="triggered">Triggered</option>
              </select>
            </label>
          </div>
          <div className="pt-2 grid grid-cols-2 gap-2">
            <Button onClick={() => onExport("trades")} className="bg-black text-white hover:bg-black/90 h-8 px-2 text-[11px] leading-none w-full">Trades CSV</Button>
            <Button onClick={() => onExport("orders")} className="bg-black text-white hover:bg-black/90 h-8 px-2 text-[11px] leading-none w-full">Orders CSV</Button>
          </div>
        </div>
      </div>
    </>
  );
}


