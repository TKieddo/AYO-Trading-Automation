import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

interface TradeRow {
  executed_at: string;
  timestamp: string;
  pnl: number | null;
  fee: number | null;
}

/**
 * Calculate PnL over time from trades.
 * Optimized: Queries Supabase directly for fast performance (trades are already saved there).
 * Only includes trades with realized PnL (pnl IS NOT NULL).
 * Groups trades by day and calculates net PnL (profit - losses - fees) for each period.
 * Returns data formatted for the PnLChart component.
 * 
 * Query params:
 * - days: number of days to fetch (default: all)
 * - range: "week" | "month" | "year" | "all" (default: "all")
 * - groupBy: "day" | "week" | "month" | "year" (optional, defaults based on range)
 * 
 * Caching: 10 seconds revalidation for period-based views to ensure fresh data
 */
export const revalidate = 10; // Cache for 10 seconds (reduced for accuracy)

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for time range filtering
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get("days");
    const rangeParam = searchParams.get("range") || "all";
    const groupByParam = searchParams.get("groupBy");
    
    // Determine grouping based on range parameter if groupBy not explicitly provided
    // Range "week" -> group by day of week, "month" -> group by week of month, "year" -> group by 2-month periods
    let groupBy = groupByParam || "day";
    if (!groupByParam && (rangeParam === "week" || rangeParam === "month" || rangeParam === "year")) {
      groupBy = rangeParam; // Use range as grouping mode
    }
    
    // Calculate date filter based on range or days
    // For week/month/year grouping, we filter to current period in calculatePnLFromTrades
    // So we don't need a restrictive startDate filter that might exclude current period data
    let startDate: Date | null = null;
    const now = new Date();
    
    // Only apply date filter for "all" or specific day ranges, not for period-based grouping
    if (daysParam) {
      const days = parseInt(daysParam, 10);
      if (!isNaN(days) && days > 0) {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - days);
      }
    } else if (rangeParam === "all") {
      // For "all", don't set startDate - show everything
      startDate = null;
    } else if (groupBy === "week" || groupBy === "month" || groupBy === "year") {
      // For period-based grouping, don't set restrictive startDate
      // The calculatePnLFromTrades function will filter to current period
      startDate = null;
    } else if (rangeParam !== "all") {
      // For other ranges, apply date filter
      startDate = new Date(now);
      if (rangeParam === "7d") {
        startDate.setDate(startDate.getDate() - 7);
      } else if (rangeParam === "30d") {
        startDate.setDate(startDate.getDate() - 30);
      } else if (rangeParam === "90d") {
        startDate.setDate(startDate.getDate() - 90);
      } else if (rangeParam === "1y") {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }
    }

    // Try Supabase first for speed, then fall back to trades/history API for syncing
    const supabase = getServerSupabase();
    let trades: any[] = [];
    
    // Step 1: Try to get trades from Supabase directly (fast path)
    if (supabase) {
      try {
        let query = supabase
          .from("trades")
          .select("executed_at, pnl, fee")
          .order("executed_at", { ascending: true });

        // Apply date filter if specified
        if (startDate) {
          query = query.gte("executed_at", startDate.toISOString());
        }

        const { data: supabaseTrades, error: supabaseError } = await query;
        
        if (!supabaseError && supabaseTrades && supabaseTrades.length > 0) {
          // Use Supabase data if available
          trades = supabaseTrades;
          console.log(`[PnL API] Using ${trades.length} trades from Supabase (fast path)`);
        }
      } catch (error) {
        console.warn("[PnL API] Supabase query failed, falling back to trades/history API:", error);
      }
    }
    
    // Step 2: If no Supabase data or we need fresh sync, use trades/history API
    // This ensures we have the latest data from Aster API
    if (trades.length === 0) {
      try {
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        
        const tradesResponse = await fetch(`${baseUrl}/api/trades/history`, {
          cache: "no-store", // Don't cache the sync call
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (tradesResponse.ok) {
          const tradesData = await tradesResponse.json();
          trades = tradesData.trades || [];
          console.log(`[PnL API] Synced ${trades.length} trades from trades/history API`);
        }
      } catch (error) {
        console.error("[PnL API] Failed to fetch from trades/history API:", error);
      }
    }

    // Filter trades with realized PnL and apply date filter
    let filteredTrades = trades.filter((t: any) => {
      // Only include trades with realized PnL
      if (t.pnl == null || t.pnl === undefined) return false;
      
      // Apply date filter if specified
      if (startDate) {
        const tradeDate = new Date(t.timestamp || t.executed_at);
        return tradeDate >= startDate;
      }
      
      return true;
    });

    // Transform to expected format
    const formattedTrades = filteredTrades.map((t: any) => ({
      executed_at: t.timestamp || t.executed_at,
      timestamp: t.timestamp || t.executed_at,
      pnl: Number(t.pnl),
      fee: t.fee != null ? Number(t.fee) : 0,
    }));
    
    console.log(`[PnL API] Query params: range=${rangeParam}, days=${daysParam}, groupBy=${groupBy}`);
    console.log(`[PnL API] Processing ${formattedTrades.length} trades with realized PnL`);
    if (formattedTrades.length > 0) {
      const firstTrade = formattedTrades[0];
      const lastTrade = formattedTrades[formattedTrades.length - 1];
      console.log(`[PnL API] Trade date range: ${firstTrade.timestamp} to ${lastTrade.timestamp}`);
    }

    const result = calculatePnLFromTrades(formattedTrades, startDate, groupBy);
    
    console.log(`[PnL API] Result: ${result.length} periods calculated`);
    if (result.length > 0) {
      console.log(`[PnL API] Sample periods:`, result.slice(0, 3).map(r => `${r.label}: ${r.daily_pnl}`));
    }
    
    // Shorter cache for period-based views to ensure fresh data
    const cacheTime = (groupBy === "week" || groupBy === "month" || groupBy === "year") ? 10 : 30;
    const cacheHeader = `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`;
    
    // Always return an array, even if empty
    // This ensures the component doesn't break
    if (!Array.isArray(result)) {
      console.error("[PnL API] calculatePnLFromTrades returned non-array:", result);
      return NextResponse.json([], {
        headers: {
          'Cache-Control': cacheHeader,
        },
      });
    }
    
    // Return with cache headers for client-side caching
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': cacheHeader,
      },
    });
  } catch (error: any) {
    console.error("Error calculating PnL over time:", error);
    // Return empty array instead of error to prevent component breakage
    const cacheTime = 10; // Short cache on error
    return NextResponse.json([], {
      status: 200, // Return 200 with empty array so component doesn't think it's an error
      headers: {
        'Cache-Control': `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`,
      },
    });
  }
}

/**
 * Calculate PnL data from trades array
 * Groups trades by time period based on groupBy parameter:
 * - "day": Group by day (default)
 * - "week": Group by day of week (M, T, W, T, F, S, S) - 7 bars
 * - "month": Group by week of month (W1, W2, W3, W4, W5) - 5 bars
 * - "year": Group by 2-month periods (6 bars: Jan-Feb, Mar-Apr, etc.)
 */
function calculatePnLFromTrades(trades: any[], startDate: Date | null, groupBy: string = "day") {
  if (!trades || trades.length === 0) {
    return [];
  }

  // Group trades by time period
  const periodMap = new Map<string, { pnl: number; fees: number; timestamp: string }>();

  for (const trade of trades) {
    // Double-check: skip if pnl is null
    if (trade.pnl == null || trade.pnl === undefined) continue;
    
    // Use timestamp or executed_at field
    const executedAt = new Date(trade.timestamp || trade.executed_at);
    
    // Skip future dates (trades that haven't happened yet)
    const now = new Date();
    const tradeDate = new Date(executedAt);
    tradeDate.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    if (tradeDate > today) {
      continue; // Skip future dates
    }
    
    // Apply date filter if specified
    if (startDate && executedAt < startDate) continue;
    
    let periodKey: string;
    let periodTimestamp: string;
    
    if (groupBy === "week") {
      // Group by day of week for CURRENT WEEK ONLY
      // Get the start of current week (Monday) using local time
      const now = new Date();
      const currentDayOfWeek = now.getDay(); // Local time
      const currentWeekStart = new Date(now);
      const currentWeekStartDiff = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
      currentWeekStart.setDate(now.getDate() + currentWeekStartDiff);
      currentWeekStart.setHours(0, 0, 0, 0);
      
      // Only include trades from the current week
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 7);
      
      // Compare using local dates (ignore time)
      const tradeDate = new Date(executedAt);
      tradeDate.setHours(0, 0, 0, 0);
      
      if (tradeDate < currentWeekStart || tradeDate >= weekEnd) {
        continue; // Skip trades not from current week
      }
      
      // Group by day of week: 0=Sunday, 1=Monday, ..., 6=Saturday
      // Map to: 0=Monday, 1=Tuesday, ..., 6=Sunday for display
      const dayOfWeek = executedAt.getDay(); // Local time
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to Sunday=6
      const dayNames = ["M", "T", "W", "T", "F", "S", "S"];
      periodKey = dayNames[dayIndex];
      periodTimestamp = currentWeekStart.toISOString();
    } else if (groupBy === "month") {
      // Group by week of month for CURRENT MONTH ONLY
      const now = new Date();
      const currentMonth = now.getMonth(); // Local time
      const currentYear = now.getFullYear();
      
      // Only include trades from the current month
      if (executedAt.getMonth() !== currentMonth || executedAt.getFullYear() !== currentYear) {
        continue; // Skip trades not from current month
      }
      
      // Calculate which week of the month (1-5) using local time
      const dayOfMonth = executedAt.getDate();
      const weekOfMonth = Math.ceil(dayOfMonth / 7);
      const weekNum = Math.min(weekOfMonth, 5); // Cap at W5
      periodKey = `W${weekNum}`;
      
      // Use the start of that week as timestamp
      const weekStart = new Date(currentYear, currentMonth, ((weekNum - 1) * 7) + 1, 0, 0, 0, 0);
      periodTimestamp = weekStart.toISOString();
    } else if (groupBy === "year") {
      // Group by 2-month periods for CURRENT PERIOD ONLY
      const now = new Date();
      const currentMonth = now.getMonth(); // Local time
      const currentYear = now.getFullYear();
      const currentPeriodIndex = Math.floor(currentMonth / 2); // 0-5
      
      // Only include trades from the current 2-month period
      const tradeMonth = executedAt.getMonth();
      const tradeYear = executedAt.getFullYear();
      const tradePeriodIndex = Math.floor(tradeMonth / 2);
      
      if (tradeYear !== currentYear || tradePeriodIndex !== currentPeriodIndex) {
        continue; // Skip trades not from current 2-month period
      }
      
      const periodMonths = [
        "Jan-Feb", "Mar-Apr", "May-Jun", 
        "Jul-Aug", "Sep-Oct", "Nov-Dec"
      ];
      periodKey = periodMonths[currentPeriodIndex];
      // Use the start of the first month in the period as timestamp
      const periodStart = new Date(currentYear, currentPeriodIndex * 2, 1, 0, 0, 0, 0);
      periodTimestamp = periodStart.toISOString();
    } else {
      // Default: group by day
      const dayKey = `${executedAt.getUTCFullYear()}-${String(executedAt.getUTCMonth() + 1).padStart(2, '0')}-${String(executedAt.getUTCDate()).padStart(2, '0')}`;
      periodKey = dayKey;
      const dayStart = new Date(Date.UTC(executedAt.getUTCFullYear(), executedAt.getUTCMonth(), executedAt.getUTCDate(), 0, 0, 0, 0));
      periodTimestamp = dayStart.toISOString();
    }
      
    const existing = periodMap.get(periodKey) || { pnl: 0, fees: 0, timestamp: periodTimestamp };
      
      // Sum PnL (can be positive or negative) - only realized PnL from closed positions
      const tradePnl = Number(trade.pnl);
      if (!isNaN(tradePnl)) {
        existing.pnl += tradePnl;
      }
      
      // Sum fees (always subtract from profit) - trading fees are costs
      const tradeFee = trade.fee != null ? Number(trade.fee) : 0;
      if (!isNaN(tradeFee)) {
        existing.fees += tradeFee;
      }
      
    periodMap.set(periodKey, existing);
    }

    // Convert to array and calculate net PnL (profit - fees)
  const periodData: Array<{ timestamp: string; daily_pnl: number; cumulative_pnl: number; label?: string }> = [];
    let cumulativePnl = 0;

  // Sort by timestamp ascending
  const sortedPeriods = Array.from(periodMap.entries()).sort((a, b) => 
    a[1].timestamp.localeCompare(b[1].timestamp)
  );

  for (const [periodKey, totals] of sortedPeriods) {
    // Net PnL = Realized PnL from trades - fees
    const netPnl = totals.pnl - totals.fees;
    cumulativePnl += netPnl;

    // Extract display label from periodKey (remove year prefix for year grouping)
    let displayLabel = periodKey;
    if (groupBy === "year" && periodKey.includes("-")) {
      // For year grouping, periodKey is "2024-Jan-Feb", extract "Jan-Feb"
      const parts = periodKey.split("-");
      if (parts.length >= 3) {
        displayLabel = parts.slice(1).join("-"); // "Jan-Feb"
      }
    }

    periodData.push({
      timestamp: totals.timestamp,
      daily_pnl: netPnl, // Period profit/loss (net of fees)
      cumulative_pnl: cumulativePnl, // Running total of profit/loss
      label: displayLabel, // Add label for display (M, T, W, W1, W2, Jan-Feb, etc.)
    });
  }

  return periodData;
}

