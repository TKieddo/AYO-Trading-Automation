"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PnLData {
  timestamp: string;
  daily_pnl: number;
  cumulative_pnl: number;
  label?: string; // Optional label for grouped periods (M, T, W, W1, W2, Jan-Feb, etc.)
}

type Range = "week" | "month" | "year";
type ExternalRange = "7d" | "30d" | "90d" | "1y" | "all";

interface PnLChartProps {
  /**
   * External date range from history page (7d, 30d, 90d, 1y, all)
   * If provided, this overrides the internal range state
   */
  externalRange?: ExternalRange;
  /**
   * Whether to show the range toggle button
   * @default true
   */
  showRangeToggle?: boolean;
}

/**
 * Converts external range (from history page) to internal range format
 */
function convertExternalRange(externalRange: ExternalRange): Range {
  if (externalRange === "7d") return "week";
  if (externalRange === "30d") return "month";
  if (externalRange === "90d" || externalRange === "1y") return "year";
  return "year"; // "all" maps to year for now
}

/**
 * Converts internal range to API range parameter
 */
function rangeToApiParam(range: Range, externalRange?: ExternalRange): string {
  // If we have an external range, use it directly for API
  if (externalRange) {
    if (externalRange === "7d") return "week";
    if (externalRange === "30d") return "month";
    if (externalRange === "90d" || externalRange === "1y") return "year";
    return "all";
  }
  return range;
}

export function PnLChart({ externalRange, showRangeToggle = true }: PnLChartProps = {}) {
  const [data, setData] = useState<PnLData[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalRange, setInternalRange] = useState<Range>("week");
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const hasInitialLoadRef = useRef(false);
  
  // Use external range if provided, otherwise use internal range
  const effectiveRange = externalRange ? convertExternalRange(externalRange) : internalRange;
  const apiRange = externalRange ? rangeToApiParam(effectiveRange, externalRange) : effectiveRange;

  useEffect(() => {
    const fetchPnL = async () => {
      const isInitialLoad = !hasInitialLoadRef.current;
      
      try {
        // Only show loading on initial load
        if (isInitialLoad) {
          setLoading(true);
        }
        
        // Pass range parameter to API for efficient filtering
        // Also pass groupBy parameter to group data correctly
        // For external ranges, convert to days if needed
        let url = `/api/pnl?range=${apiRange}&groupBy=${effectiveRange}`;
        if (externalRange === "7d") {
          url = `/api/pnl?days=7&groupBy=week`;
        } else if (externalRange === "30d") {
          url = `/api/pnl?days=30&groupBy=month`;
        } else if (externalRange === "90d") {
          url = `/api/pnl?days=90&groupBy=month`;
        } else if (externalRange === "1y") {
          url = `/api/pnl?days=365&groupBy=year`;
        } else if (externalRange === "all") {
          url = `/api/pnl?range=all&groupBy=year`;
        } else if (effectiveRange === "year" && !externalRange) {
          // Handle year filter when clicked directly (not from external range)
          url = `/api/pnl?range=year&groupBy=year`;
        }
        
        // Use browser cache for fast responses - API sets Cache-Control headers
        // Browser will cache for 30s, allowing instant filter switching
        const response = await fetch(url, {
          cache: 'default', // Use browser cache (respects Cache-Control from API)
        });
        
        if (response.ok) {
          const result = await response.json();
          setData(Array.isArray(result) ? result : []);
          hasInitialLoadRef.current = true;
          
          // Debug logging
          if (process.env.NODE_ENV === "development") {
            console.log(`[PnLChart] Fetched ${result?.length || 0} data points for range: ${apiRange} (external: ${externalRange || 'none'})`);
          }
        } else {
          const errorText = await response.text();
          console.error("Failed to fetch P&L data:", response.status, errorText);
          // Don't clear data on error - keep showing previous data
        }
      } catch (error) {
        console.error("Failed to fetch P&L data:", error);
        // Don't clear data on error - keep showing previous data
      } finally {
        setLoading(false);
      }
    };

    fetchPnL();
    
    // Poll for updates every 30 seconds (matches cache TTL)
    const interval = setInterval(fetchPnL, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [apiRange, externalRange, effectiveRange, internalRange]); // Re-fetch when range changes

  const points = useMemo(() => {
    // Create a map of label -> value from API data
    const dataMap = new Map<string, number>();
    if (data && data.length > 0) {
      for (const p of data) {
        const label = p.label || new Date(p.timestamp).toLocaleDateString();
        dataMap.set(label, Number(p.daily_pnl ?? 0));
      }
    }
    
    // Determine grouping mode based on effectiveRange and externalRange
    // When groupBy is "week" -> show all 7 days (M, T, W, T, F, S, S)
    // When groupBy is "month" -> show all 5 weeks (W1, W2, W3, W4, W5)
    // When groupBy is "year" -> show all 12 months
    
    // Check if we're in week mode (groupBy=week) - show all 7 days (API filters to current week only)
    if (effectiveRange === "week" || externalRange === "7d") {
      const weekdayLetters = ["M", "Tu", "W", "Th", "F", "Sa", "Su"]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
      return weekdayLetters.map(label => ({
        label,
        value: dataMap.get(label) ?? 0
      }));
    }
    
    // Check if we're in month mode (groupBy=month) - show all 5 weeks (API filters to current month only)
    // This applies when externalRange is 30d or 90d, or when effectiveRange is month
    if (effectiveRange === "month" || externalRange === "30d" || externalRange === "90d") {
      const weekLabels = ["W1", "W2", "W3", "W4", "W5"];
      return weekLabels.map(label => ({
        label,
        value: dataMap.get(label) ?? 0
      }));
    }
    
    // Check if we're in year mode (groupBy=year) - always show all 6 two-month periods
    if (effectiveRange === "year" || externalRange === "1y" || externalRange === "all") {
      const twoMonthPeriods = ["Jan-Feb", "Mar-Apr", "May-Jun", "Jul-Aug", "Sep-Oct", "Nov-Dec"];
      return twoMonthPeriods.map(label => ({
        label,
        value: dataMap.get(label) ?? 0
      }));
    }
    
    // If API provides labels (for grouped data), use them but ensure completeness
    if (data && data.length > 0 && data[0]?.label) {
      // Check if it's week grouping (M, T, W, T, F, Sa, Su)
      const firstLabel = data[0].label;
      if (["M", "T", "W", "F", "Sa", "Su"].includes(firstLabel)) {
        const weekdayLetters = ["M", "T", "W", "T", "F", "Sa", "Su"]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
        return weekdayLetters.map(label => ({
          label,
          value: dataMap.get(label) ?? 0
        }));
      }
      
      // Check if it's month grouping (W1, W2, W3, W4, W5)
      if (firstLabel.startsWith("W") && /^W[1-5]$/.test(firstLabel)) {
        const weekLabels = ["W1", "W2", "W3", "W4", "W5"];
        return weekLabels.map(label => ({
          label,
          value: dataMap.get(label) ?? 0
        }));
      }
      
      // Check if it's year grouping (Jan-Feb, Mar-Apr, etc.)
      if (firstLabel.includes("-") && ["Jan-Feb", "Mar-Apr", "May-Jun", "Jul-Aug", "Sep-Oct", "Nov-Dec"].some(p => firstLabel.includes(p))) {
        const twoMonthPeriods = ["Jan-Feb", "Mar-Apr", "May-Jun", "Jul-Aug", "Sep-Oct", "Nov-Dec"];
        return twoMonthPeriods.map(label => ({
          label,
          value: dataMap.get(label) ?? 0
        }));
      }
      
      // For other cases, return the data as-is
      return data.map(p => ({
        label: p.label || new Date(p.timestamp).toLocaleDateString(),
        value: Number(p.daily_pnl ?? 0)
      }));
    }
    
    // Otherwise, fall back to client-side grouping for backward compatibility
    const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayMap = new Map<string, number>();
    
    // Build day map from API data (already grouped by day)
    for (const p of data) {
      const d = new Date(p.timestamp);
      const key = dayKey(d);
      const v = Number(p.daily_pnl ?? 0);
      // Sum daily PnL for the same day (shouldn't happen, but just in case)
      dayMap.set(key, (dayMap.get(key) ?? 0) + v);
    }
    
    const weekdayLetters = ["M","T","W","T","F","Sa","Su"]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const startOfWeekMon = (dt: Date) => {
      const d = new Date(dt);
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0,0,0,0);
      return d;
    };
    
    const toMonSunWeek = () => {
      const now = new Date();
      const start = startOfWeekMon(now);
      const days: { label: string; value: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = dayKey(d);
        const val = dayMap.get(key) ?? 0;
        days.push({ label: weekdayLetters[i], value: val });
      }
      return days;
    };
    
    // Year mode should already be handled above, but keep this as fallback
    // This should not be reached if year mode is properly detected
    
    // If we have no data and no specific range, return empty array
    // But if we're in a known range mode, ensure we show all periods
    if (!data || data.length === 0) {
      // For week mode, show all 7 days with 0 values
      if (effectiveRange === "week") {
        const weekdayLetters = ["M", "Tu", "W", "Th", "F", "Sa", "Su"]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
        return weekdayLetters.map(label => ({ label, value: 0 }));
      }
      // For month mode, show all 5 weeks with 0 values
      if (effectiveRange === "month") {
        const weekLabels = ["W1", "W2", "W3", "W4", "W5"];
        return weekLabels.map(label => ({ label, value: 0 }));
      }
      // For year mode, show all 6 two-month periods with 0 values
      if (effectiveRange === "year" || externalRange === "1y" || externalRange === "all") {
        const twoMonthPeriods = ["Jan-Feb", "Mar-Apr", "May-Jun", "Jul-Aug", "Sep-Oct", "Nov-Dec"];
        return twoMonthPeriods.map(label => ({ label, value: 0 }));
      }
    }
    
    return [];
  }, [data, effectiveRange, externalRange]);

  useEffect(() => {
    setActiveIndex(points.length > 0 ? points.length - 1 : 0);
  }, [points]);

  const maxVal = useMemo(() => Math.max(1, ...points.map((p) => Math.abs(p.value))), [points]);
  const active = points[activeIndex] || { value: 0 };

  if (loading) {
    return (
      <Card className="rounded-[24px] bg-white">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-slate-800 text-[22px] font-semibold">
            <DollarSign className="w-5 h-5" />
            Daily Realized PnL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-pulse text-slate-500">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!data || data.length === 0 || points.length === 0) {
    return (
      <div className="relative">
        {showRangeToggle && (
          <div className="absolute top-5 right-4 z-50 flex items-center gap-1.5 pointer-events-auto">
            {(["week", "month", "year"] as Range[]).map((range) => {
              const isActive = effectiveRange === range;
              return (
                <button
                  key={range}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all pointer-events-auto ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Always allow clicks - instant switching
                    setInternalRange(range);
                  }}
                  title={`View ${range} range`}
                  type="button"
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              );
            })}
          </div>
        )}
        <Card className="rounded-[24px] bg-white">
          <CardHeader className="py-3 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-slate-800 text-[22px] font-semibold">
                <DollarSign className="w-5 h-5" />
                Daily Realized PnL
              </CardTitle>
            </div>
          </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">
            No realized PnL data yet. Close some positions to see PnL over time.
          </div>
        </CardContent>
      </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {showRangeToggle && (
        <div className="absolute top-5 right-4 z-50 flex items-center gap-1.5 pointer-events-auto">
          {(["week", "month", "year"] as Range[]).map((range) => {
            const isActive = effectiveRange === range;
            return (
              <button
                key={range}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all pointer-events-auto ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Always allow clicks - instant switching
                  setInternalRange(range);
                }}
                title={`View ${range} range`}
                type="button"
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            );
          })}
        </div>
      )}
      <Card className="rounded-[24px] bg-white">
        <CardHeader className="py-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-slate-800 text-[22px] font-semibold">
              <DollarSign className="w-5 h-5" /> Daily Realized PnL
            </CardTitle>
          </div>
          {/* Realized PnL only; no mock text */}
        </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-12 gap-4 items-end">
          {/* Legend/summary (minimal) */}
          <div className="col-span-3 flex flex-col justify-end pb-4 pl-2">
            <div className="text-sm text-slate-600">Hover a bar to see value</div>
            <div className="text-2xl font-semibold text-slate-900">{formatCurrency(active.value)}</div>
          </div>

          {/* Chart */}
          <div className="col-span-9">
            <div className="relative h-[280px] rounded-2xl bg-white pt-4">
              {/* Bars (black for profit, orange for loss), baseline at bottom */}
              <div className="absolute inset-x-0 bottom-0 left-0 right-0 flex items-end justify-between px-4 pb-8">
                {points.map((p, idx) => {
                  const height = Math.max(4, Math.round((Math.abs(p.value) / maxVal) * 200));
                  const isActive = idx === activeIndex;
                  const isGain = p.value >= 0;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 select-none" onMouseEnter={() => setActiveIndex(idx)}>
                      {/* Value bubble */}
                      {isActive && (
                        <div className="mb-2 translate-y-8 z-20 relative">
                          <div className="px-3 py-1 rounded-full text-black text-xs font-semibold shadow-lg" style={{ backgroundColor: '#d0d926' }}>
                            {formatCurrency(p.value)}
                          </div>
                        </div>
                      )}
                      {/* Bar with grey rounded background track */}
                      <div className={`w-11 ${isActive ? "h-[230px]" : "h-[210px]"} rounded-full bg-gradient-to-b from-slate-100 to-white flex items-end justify-center transition-all duration-300`}>
                        <div className={`absolute w-[2px] h-[180px] bg-slate-200`} />
                        <div className={`${isGain ? "bg-black" : "bg-orange-400"} rounded-[6px] transition-all duration-300`} style={{ height, width: isActive ? 24 : 8 }} />
                      </div>
                      {/* Day pill */}
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold ${isActive ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"} text-sm px-1`}>{p.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

