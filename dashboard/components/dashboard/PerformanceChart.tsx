"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ArrowUpRight, Triangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface DailyPerformance {
  date: string;
  wins: number;
  losses: number;
  totalTrades: number;
  winPct: number;
  lossPct: number;
  netPnl: number;
  trades: Array<{
  pnl: number;
    fee: number;
    isWin: boolean;
  }>;
}

interface PerformanceResponse {
  daily: DailyPerformance[];
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  overallWinPct: number;
  overallLossPct: number;
  totalProfit: number;
  totalPnL: number;
  totalFees: number;
}

type Range = "week" | "month" | "year";

export function PerformanceChart() {
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("month");
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState<number>(0);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        // Use browser cache for fast responses - API sets Cache-Control headers
        const response = await fetch("/api/performance/dashboard", {
          cache: 'default', // Use browser cache (respects Cache-Control from API)
        });
        
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          console.error("Failed to fetch performance data:", response.status);
        }
      } catch (error) {
        console.error("Failed to fetch performance data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
    // Poll for updates every 30 seconds (matches cache TTL)
    const interval = setInterval(fetchPerformance, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter daily data based on range
  const filteredDaily = useMemo(() => {
    if (!data?.daily) return [];

    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;
    const cutoff = range === "week" ? now - 6 * dayMs 
                   : range === "month" ? now - 29 * dayMs 
                   : now - 364 * dayMs;
    
    return data.daily.filter(day => {
      const dayDate = new Date(day.date + "T00:00:00").getTime();
      return dayDate >= cutoff;
    });
  }, [data, range]);

  // Group filtered daily data into buckets based on range
  const buckets = useMemo(() => {
    if (!filteredDaily.length) return [];

    if (range === "week") {
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const now = new Date();
      const day = now.getDay();
      const mondayOffset = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayData = filteredDaily.find(d => d.date === dayKey);
        return {
          label: labels[i],
          date: dayKey,
          data: dayData || {
            date: dayKey,
            wins: 0,
            losses: 0,
            totalTrades: 0,
            winPct: 0,
            lossPct: 0,
            netPnl: 0,
            trades: [],
          },
        };
      });
    }

    if (range === "month") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const weeks: Array<{ label: string; date: string; data: DailyPerformance }> = [];
      let cur = new Date(start);
      let w = 1;

      while (cur <= end) {
        const weekStart = new Date(cur);
        const weekEnd = new Date(cur);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Aggregate all days in this week
        const weekDays = filteredDaily.filter(d => {
          const dayDate = new Date(d.date + "T00:00:00");
          return dayDate >= weekStart && dayDate <= weekEnd && dayDate.getMonth() === now.getMonth();
        });

        const aggregated: DailyPerformance = weekDays.reduce(
          (acc, day) => ({
            date: weekStart.toISOString().split("T")[0],
            wins: acc.wins + day.wins,
            losses: acc.losses + day.losses,
            totalTrades: acc.totalTrades + day.totalTrades,
            winPct: 0, // Will calculate
            lossPct: 0, // Will calculate
            netPnl: acc.netPnl + day.netPnl,
            trades: [...acc.trades, ...day.trades],
          }),
          {
            date: weekStart.toISOString().split("T")[0],
            wins: 0,
            losses: 0,
            totalTrades: 0,
            winPct: 0,
            lossPct: 0,
            netPnl: 0,
            trades: [],
          }
        );

        aggregated.winPct = aggregated.totalTrades > 0 
          ? Math.round((aggregated.wins / aggregated.totalTrades) * 100) 
          : 0;
        aggregated.lossPct = aggregated.totalTrades > 0 
          ? Math.round((aggregated.losses / aggregated.totalTrades) * 100) 
          : 0;

        weeks.push({
          label: `W${w}`,
          date: aggregated.date,
          data: aggregated,
        });

        cur.setDate(cur.getDate() + 7);
        w++;
      }

      return weeks;
    }

    // year: group by month
    const monthLabels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return Array.from({ length: 12 }, (_, i) => {
      const monthDays = filteredDaily.filter(d => {
        const [year, month] = d.date.split("-");
        return Number(month) === i + 1;
      });

      const aggregated: DailyPerformance = monthDays.reduce(
        (acc, day) => ({
          date: `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}-01`,
          wins: acc.wins + day.wins,
          losses: acc.losses + day.losses,
          totalTrades: acc.totalTrades + day.totalTrades,
          winPct: 0,
          lossPct: 0,
          netPnl: acc.netPnl + day.netPnl,
          trades: [...acc.trades, ...day.trades],
        }),
        {
          date: `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}-01`,
          wins: 0,
          losses: 0,
          totalTrades: 0,
          winPct: 0,
          lossPct: 0,
          netPnl: 0,
          trades: [],
        }
      );

      aggregated.winPct = aggregated.totalTrades > 0 
        ? Math.round((aggregated.wins / aggregated.totalTrades) * 100) 
        : 0;
      aggregated.lossPct = aggregated.totalTrades > 0 
        ? Math.round((aggregated.losses / aggregated.totalTrades) * 100) 
        : 0;
    
    return {
        label: monthLabels[i],
        date: aggregated.date,
        data: aggregated,
      };
    });
  }, [filteredDaily, range]);

  // Set default selected column to latest (most recent) period
  useEffect(() => {
    if (buckets.length > 0) {
      // Find the most recent bucket with data, or use the last one
      let latestIndex = buckets.length - 1;
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (buckets[i].data.totalTrades > 0) {
          latestIndex = i;
          break;
        }
      }
      setSelectedCol(latestIndex);
    }
  }, [buckets, range]);

  const activeCol = hoveredCol != null ? hoveredCol : selectedCol;
  const activeDayData = buckets[activeCol]?.data;

  // Use overall stats or day-specific stats
  const totalTrades = data?.totalTrades || 0;
  const totalWins = data?.totalWins || 0;
  const totalLosses = data?.totalLosses || 0;
  const overallWinPct = data?.overallWinPct || 0;
  const overallLossPct = data?.overallLossPct || 0;
  const totalProfit = data?.totalProfit || 0;
  
  // Use day-specific stats when hovering/selecting, default to current period stats
  // If no active day data but we have buckets, use the selected bucket's data
  const currentPeriodData = activeDayData || (buckets[selectedCol]?.data);
  const gainsPct = currentPeriodData ? currentPeriodData.winPct : overallWinPct;
  const lossesPct = currentPeriodData ? currentPeriodData.lossPct : overallLossPct;
  const dayWins = currentPeriodData ? currentPeriodData.wins : totalWins;
  const dayLosses = currentPeriodData ? currentPeriodData.losses : totalLosses;
  const dayTrades = currentPeriodData ? currentPeriodData.totalTrades : totalTrades;

  // Calculate best/worst PnL for active day/period
  const activeTrades = currentPeriodData?.trades || [];
  const bestPnl = activeTrades.length > 0 
    ? Math.max(...activeTrades.map(t => t.pnl))
    : 0;
  const worstPnl = activeTrades.length > 0 
    ? Math.min(...activeTrades.map(t => t.pnl))
    : 0;
  const avgPnl = activeTrades.length > 0
    ? activeTrades.reduce((sum, t) => sum + t.pnl, 0) / activeTrades.length
    : 0;
  const netPnl = currentPeriodData ? currentPeriodData.netPnl : totalProfit;

  const dotRows = 8; // Maximum dots per column

  if (loading) {
    return (
      <Card className="rounded-[24px] bg-black text-white">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-white text-[18px] font-semibold">
            <TrendingUp className="w-5 h-5" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] flex items-center justify-center">
            <div className="animate-pulse text-white/70">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalTrades === 0) {
    return (
      <Card className="rounded-[24px] bg-black text-white">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-white text-[18px] font-semibold">
            <TrendingUp className="w-5 h-5" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-white/70">
            No trades yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[24px] bg-black text-white w-full min-w-0">
      <CardHeader className="py-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[12px] text-white/70 mb-1 flex items-center gap-2">
              <TrendingUp className="w-[14px] h-[14px]" /> Market performance forecast
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[22px] md:text-[26px] font-semibold">{formatCurrency(totalProfit)}</div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${totalProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {totalProfit >= 0 ? '+' : ''}{((totalProfit / Math.max(1, Math.abs(data.totalPnL - data.totalFees))) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-3 py-1.5 text-[11px] hover:bg-white/15"
              onClick={() => setRange((r) => (r === 'week' ? 'month' : r === 'month' ? 'year' : 'week'))}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="w-full">
        {/* Win/Loss percentages - updates with hover */}
        <div className="mb-2 grid grid-cols-2 gap-6 text-white">
          <div className="flex items-center gap-2">
            <Triangle className="w-3 h-3 text-emerald-400 -rotate-90 fill-emerald-400" />
            <div>
              <div className="text-2xl font-extrabold leading-none">{gainsPct}%</div>
              <div className="text-[12px] text-white/70">Gains</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Triangle className="w-3 h-3 text-orange-400 rotate-90 fill-orange-400" />
            <div>
              <div className="text-2xl font-extrabold leading-none">{lossesPct}%</div>
              <div className="text-[12px] text-white/70">Losses</div>
            </div>
          </div>
        </div>

        {/* Trades summary */}
        <div className="mb-3 grid grid-cols-3 gap-4 text-white/80 text-[12px]">
          <div>Total trades: <span className="text-white font-semibold">{dayTrades}</span></div>
          <div>Won: <span className="text-emerald-400 font-semibold">{dayWins}</span></div>
          <div>Lost: <span className="text-orange-400 font-semibold">{dayLosses}</span></div>
        </div>

        {/* PnL metrics */}
        <div className="mb-4 grid grid-cols-4 gap-4 text-white/80 text-[12px]">
          <div>Net PnL: <span className={`font-semibold ${netPnl >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>{formatCurrency(netPnl)}</span></div>
          <div>Avg trade: <span className={`font-semibold ${avgPnl >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>{formatCurrency(avgPnl)}</span></div>
          <div>Best: <span className="text-emerald-400 font-semibold">{formatCurrency(bestPnl)}</span></div>
          <div>Worst: <span className="text-orange-400 font-semibold">{formatCurrency(worstPnl)}</span></div>
        </div>

        {/* Dot matrix - 2 columns per day (green wins, orange losses), 1 column for year */}
        <div className="rounded-2xl bg-black/20 p-3 overflow-hidden w-full">
          <div className={`flex items-end ${range === 'year' ? 'justify-center gap-0.5' : range === 'month' ? 'justify-between gap-1' : 'justify-between gap-1'} w-full`} onMouseLeave={() => setHoveredCol(null)}>
            {buckets.map((bucket, colIdx) => {
              const dayData = bucket.data;
              const totalDayTrades = dayData.totalTrades;
              const wins = dayData.wins;
              const losses = dayData.losses;

              // Calculate dots proportional to wins/losses ratio
              // Each column can have up to dotRows dots
              const maxDots = dotRows;
              
              // Calculate proportional dots based on wins/losses ratio
              let actualGreen = 0;
              let actualOrange = 0;
              
              if (totalDayTrades > 0) {
                if (wins > 0 && losses > 0) {
                  // Both wins and losses: show proportional dots
                  const ratio = wins / (wins + losses);
                  actualGreen = Math.max(1, Math.round(ratio * maxDots));
                  actualOrange = Math.max(1, Math.round((1 - ratio) * maxDots));
                  
                  // Normalize to fit within maxDots
                  const total = actualGreen + actualOrange;
                  if (total > maxDots) {
                    actualGreen = Math.round((actualGreen / total) * maxDots);
                    actualOrange = maxDots - actualGreen;
                  }
                } else if (wins > 0) {
                  // Only wins
                  actualGreen = Math.min(wins, maxDots);
                  actualOrange = 0;
                } else if (losses > 0) {
                  // Only losses
                  actualGreen = 0;
                  actualOrange = Math.min(losses, maxDots);
                }
              }

              const isActive = colIdx === activeCol;
              const isYearView = range === 'year';
              
              return (
                <div
                  key={bucket.label}
                  className={`flex flex-col items-center cursor-pointer select-none ${range === 'year' ? 'gap-0.5' : 'gap-1'}`}
                  onMouseEnter={() => setHoveredCol(colIdx)}
                  onClick={() => setSelectedCol(colIdx)}
                >
                  {/* For year: single column (green/orange mixed), for week/month: two columns */}
                  {isYearView ? (
                    // Year view: single column with mixed dots
                    <div className={`flex flex-col-reverse gap-1 ${isActive ? 'scale-[1.06]' : ''}`}>
                      {/* Show wins first (green), then losses (orange) */}
                      {Array.from({ length: actualGreen }, (_, i) => (
                        <div key={`green-${i}`} className="h-2 w-2 rounded-full bg-emerald-400" />
                      ))}
                      {Array.from({ length: actualOrange }, (_, i) => (
                        <div key={`orange-${i}`} className="h-2 w-2 rounded-full bg-orange-400" />
                      ))}
                    </div>
                  ) : (
                    // Week/Month view: two columns (green on left, orange on right)
                    <div className={`flex items-end gap-1 ${isActive ? 'scale-[1.06]' : ''}`}>
                      {/* Green column (wins) */}
                      <div className="flex flex-col-reverse gap-1">
                        {Array.from({ length: actualGreen }, (_, i) => (
                          <div key={`green-${i}`} className="h-2 w-2 rounded-full bg-emerald-400" />
                        ))}
                      </div>
                      {/* Orange column (losses) */}
                      <div className="flex flex-col-reverse gap-1">
                        {Array.from({ length: actualOrange }, (_, i) => (
                          <div key={`orange-${i}`} className="h-2 w-2 rounded-full bg-orange-400" />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Day/Month label - ensure it doesn't overflow */}
                  <div className={`text-[10px] whitespace-nowrap text-center ${range === 'year' ? 'mt-0.5' : 'mt-1'} ${isActive ? 'text-white font-semibold' : 'text-white/60'}`} style={{ 
                    minWidth: range === 'year' ? '24px' : range === 'month' ? '24px' : '32px',
                    maxWidth: range === 'year' ? '28px' : range === 'month' ? '28px' : '40px'
                  }}>
                    {bucket.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
