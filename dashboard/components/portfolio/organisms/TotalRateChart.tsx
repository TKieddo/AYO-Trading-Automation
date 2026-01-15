"use client";

import { useState, useEffect } from "react";

export type PeriodAccountValueData = {
  date: string; // ISO string
  openingBalance: number;
  closingBalance: number;
  gains: number;
  losses: number;
  periodLabel: string; // Day name, week number, or month name
};

type TotalRateChartProps = {
  data?: PeriodAccountValueData[];
  currentValue?: number;
};

type Period = "week" | "month" | "year";

const periodOptions: { value: Period; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export function TotalRateChart({ data, currentValue }: TotalRateChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("year");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<"gain" | "loss" | null>(null);
  const [mounted, setMounted] = useState(false);
  const [periodData, setPeriodData] = useState<PeriodAccountValueData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch period-based account value data
  useEffect(() => {
    setMounted(true);
    
    if (data) {
      setPeriodData(data);
      setLoading(false);
    } else {
      async function fetchPeriodData() {
        try {
          setLoading(true);
          const response = await fetch(`/api/account-value/period?period=${selectedPeriod}`);
          if (response.ok) {
            const result = await response.json();
            setPeriodData(result.periodData || []);
          }
        } catch (error) {
          console.error("Failed to fetch period-based account value data:", error);
        } finally {
          setLoading(false);
        }
      }
      fetchPeriodData();
    }
  }, [selectedPeriod, data]);

  // Get display data (sorted by date)
  const displayData = periodData.length > 0 
    ? [...periodData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  // Calculate max for scaling (use both gains and losses)
  const allGains = displayData.map(d => d.gains);
  const allLosses = displayData.map(d => d.losses);
  const maxGain = Math.max(...allGains, 1);
  const maxLoss = Math.max(...allLosses, 1);
  const maxChange = Math.max(maxGain, maxLoss);

  // Calculate height for change rectangles (proportional to change magnitude)
  const getChangeHeight = (change: number, maxHeight: number = 90) => {
    if (maxChange === 0) return 0;
    const proportion = Math.abs(change) / maxChange;
    return Math.max(12, proportion * maxHeight); // Min 12px for visibility
  };

  // Show loading state
  if (loading || !mounted) {
    return (
      <div className="rounded-2xl bg-black p-6 ring-1 ring-slate-800">
        <div className="flex items-center justify-between mb-6">
          <div className="text-white font-semibold text-lg tracking-tight">ACCOUNT VALUE</div>
          <div className="flex items-center gap-2">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-tight bg-white text-black opacity-50"
                disabled
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="text-white/50 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  if (displayData.length === 0) {
    return (
      <div className="rounded-2xl bg-black p-6 ring-1 ring-slate-800">
        <div className="flex items-center justify-between mb-6">
          <div className="text-white font-semibold text-lg tracking-tight">ACCOUNT VALUE</div>
          <div className="flex items-center gap-2">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedPeriod(option.value)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all ${
                  selectedPeriod === option.value
                    ? 'bg-[#f4ff6e] text-black'
                    : 'bg-white text-black hover:opacity-90'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64 flex flex-col items-center justify-center gap-2">
          <div className="text-white/50 text-sm">No data available</div>
          <div className="text-white/30 text-xs text-center max-w-xs">
            Data will appear once account value history and portfolio activities are synced
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-black p-6 ring-1 ring-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div className="text-white font-semibold text-lg tracking-tight">ACCOUNT VALUE</div>
        {/* Period filter buttons */}
        <div className="flex items-center gap-2">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedPeriod(option.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all ${
                selectedPeriod === option.value
                  ? 'bg-[#f4ff6e] text-black'
                  : 'bg-white text-black hover:opacity-90'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="relative">
        {/* Chart container */}
        <div 
          className="grid h-64 relative"
          style={{ 
            gridTemplateColumns: `repeat(${displayData.length}, minmax(0, 1fr))`,
            gap: '8px' // Reduced gap from 16px to 8px
          }}
        >
          {displayData.map((period, i) => {
            const gainHeight = getChangeHeight(period.gains);
            const lossHeight = getChangeHeight(period.losses);
            const openingBalance = period.openingBalance;
            const closingBalance = period.closingBalance;
            const date = new Date(period.date);
            const periodLabel = period.periodLabel;
            
            return (
              <div 
                key={i} 
                className="relative flex flex-col items-center justify-center h-full group"
                onMouseLeave={() => {
                  setHoveredIndex(null);
                  setHoveredBar(null);
                }}
              >
                {/* Vertical line */}
                <div className="absolute left-1/2 top-0 bottom-0 bg-white/30 -translate-x-1/2 z-0" style={{ width: '1px' }} />
                
                <div className="relative flex flex-col items-center justify-center h-full">
                  {/* Gain rectangle - always extends UP */}
                  {gainHeight > 0 && (
                    <div
                      className="rounded-full transition-all z-10 relative mb-1 cursor-pointer"
                      style={{
                        backgroundColor: '#c4f542',
                        width: 24, // Reduced from 36px to 24px
                        height: gainHeight,
                        minHeight: 12,
                      }}
                      onMouseEnter={() => {
                        setHoveredIndex(i);
                        setHoveredBar('gain');
                      }}
                    />
                  )}
                  
                  {/* Middle dot - always at center (opening balance) */}
                  <div 
                    className={`bg-white w-3 h-3 rounded-full z-20 relative transition-all cursor-pointer ${
                      hoveredIndex === i ? 'scale-125 ring-2 ring-[#F4FF6E]' : ''
                    }`}
                    onMouseEnter={() => {
                      setHoveredIndex(i);
                      setHoveredBar(null);
                    }}
                  />
                  
                  {/* Loss rectangle - always extends DOWN */}
                  {lossHeight > 0 && (
                    <div
                      className="rounded-full transition-all z-10 relative mt-1 cursor-pointer"
                      style={{
                        backgroundColor: '#ff6b35',
                        width: 24, // Reduced from 36px to 24px
                        height: lossHeight,
                        minHeight: 12,
                      }}
                      onMouseEnter={() => {
                        setHoveredIndex(i);
                        setHoveredBar('loss');
                      }}
                    />
                  )}
                  
                  {/* Gain tooltip - shows closing balance and total gains */}
                  {hoveredIndex === i && hoveredBar === 'gain' && period.gains > 0 && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#F4FF6E] text-slate-900 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg z-30 shadow-xl ring-1 ring-black/20 pointer-events-none min-w-[120px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="font-bold">${Math.round(closingBalance).toLocaleString()}</div>
                        <div className="text-[9px] font-medium text-emerald-700">+${period.gains.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div className="text-[9px] font-medium opacity-80">
                          {periodLabel}
                        </div>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-[#F4FF6E]"></div>
                    </div>
                  )}
                  
                  {/* Loss tooltip - shows closing balance and total losses */}
                  {hoveredIndex === i && hoveredBar === 'loss' && period.losses > 0 && (
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-[#F4FF6E] text-slate-900 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg z-30 shadow-xl ring-1 ring-black/20 pointer-events-none min-w-[120px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="font-bold">${Math.round(closingBalance).toLocaleString()}</div>
                        <div className="text-[9px] font-medium text-red-700">-${period.losses.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div className="text-[9px] font-medium opacity-80">
                          {periodLabel}
                        </div>
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-[#F4FF6E]"></div>
                    </div>
                  )}
                  
                  {/* Tooltip for middle dot - shows opening balance */}
                  {hoveredIndex === i && hoveredBar === null && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#F4FF6E] text-slate-900 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg z-30 shadow-xl ring-1 ring-black/20 pointer-events-none min-w-[120px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="font-bold">${Math.round(openingBalance).toLocaleString()}</div>
                        <div className="text-[9px] font-medium opacity-80">
                          Opening Balance
                        </div>
                        <div className="text-[9px] font-medium opacity-80">
                          {periodLabel}
                        </div>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-[#F4FF6E]"></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* X-axis labels */}
        <div 
          className="grid mt-4"
          style={{ 
            gridTemplateColumns: `repeat(${displayData.length}, minmax(0, 1fr))`,
            gap: '8px'
          }}
        >
          {displayData.map((period, i) => (
            <div key={i} className="flex justify-center">
              <span className="text-white/60 text-[10px] font-medium tracking-tight">
                {period.periodLabel}
              </span>
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#c4f542' }} />
            <span className="text-white text-xs font-medium tracking-tight">Total Gains</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff6b35' }} />
            <span className="text-white text-xs font-medium tracking-tight">Total Losses</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white" />
            <span className="text-white text-xs font-medium tracking-tight">Opening Balance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
