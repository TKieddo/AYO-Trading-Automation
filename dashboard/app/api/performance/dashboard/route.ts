import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

interface TradeRow {
  executed_at: string;
  pnl: number | null;
  fee: number | null;
}

interface DailyPerformance {
  date: string; // YYYY-MM-DD format
  wins: number;
  losses: number;
  totalTrades: number;
  winPct: number;
  lossPct: number;
  netPnl: number; // PnL - fees for that day
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
  totalProfit: number; // All-time profit (profits - losses - fees)
  totalPnL: number; // Sum of all PnL (before fees)
  totalFees: number; // Sum of all fees
}

/**
 * Calculate performance metrics from trades for the dashboard.
 * Optimized: Queries Supabase directly for fast performance.
 * Groups trades by day and calculates win/loss statistics.
 * Returns all-time totals and daily breakdowns.
 * 
 * No caching - always returns fresh data
 */
export const dynamic = 'force-dynamic'; // Mark as dynamic route

export async function GET() {
  try {
    // Try Supabase first for speed, then fall back to trades/history API for syncing
    const supabase = getServerSupabase();
    let trades: any[] = [];
    
    // Step 1: Try to get trades from Supabase directly (fast path)
    if (supabase) {
      try {
        const { data: supabaseTrades, error: supabaseError } = await supabase
          .from("trades")
          .select("executed_at, pnl, fee")
          .order("executed_at", { ascending: true });
        
        if (!supabaseError && supabaseTrades && supabaseTrades.length > 0) {
          trades = supabaseTrades;
          console.log(`[Performance API] Using ${trades.length} trades from Supabase (fast path)`);
        }
      } catch (error) {
        console.warn("[Performance API] Supabase query failed, falling back to trades/history API:", error);
      }
    }
    
    // Step 2: If no Supabase data, use trades/history API for syncing
    if (trades.length === 0) {
      try {
        const url = new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001");
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
          console.log(`[Performance API] Synced ${trades.length} trades from trades/history API`);
        }
      } catch (error) {
        console.error("[Performance API] Failed to fetch from trades/history API:", error);
      }
    }

    if (!trades || trades.length === 0) {
      return NextResponse.json({
        daily: [],
        totalTrades: 0,
        totalWins: 0,
        totalLosses: 0,
        overallWinPct: 0,
        overallLossPct: 0,
        totalProfit: 0,
        totalPnL: 0,
        totalFees: 0,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
        },
      });
    }

    // Group trades by day
    const dayMap = new Map<string, DailyPerformance>();

    // Filter trades with realized PnL and exclude future dates
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (const trade of trades as any[]) {
      // Use timestamp or executed_at field
      const executedAt = new Date(trade.timestamp || trade.executed_at);
      
      // Skip future dates
      const tradeDate = new Date(executedAt);
      tradeDate.setHours(0, 0, 0, 0);
      if (tradeDate > today) {
        continue; // Skip future dates
      }
      
      const dayKey = `${executedAt.getFullYear()}-${String(executedAt.getMonth() + 1).padStart(2, '0')}-${String(executedAt.getDate()).padStart(2, '0')}`;
      
      const existing = dayMap.get(dayKey) || {
        date: dayKey,
        wins: 0,
        losses: 0,
        totalTrades: 0,
        winPct: 0,
        lossPct: 0,
        netPnl: 0,
        trades: [],
      };

      const tradePnl = trade.pnl != null ? Number(trade.pnl) : null;
      const tradeFee = trade.fee != null ? Number(trade.fee) : 0;
      
      // Only count trades with realized PnL (not null, can be 0)
      if (tradePnl === null || tradePnl === undefined) {
        // Skip trades without realized PnL
        continue;
      }

      const isWin = tradePnl > 0;

      if (isWin) {
        existing.wins++;
        existing.totalTrades++;
      } else if (tradePnl < 0) {
        existing.losses++;
        existing.totalTrades++;
      }

      existing.netPnl += tradePnl - tradeFee; // Net PnL after fees
      existing.trades.push({
        pnl: tradePnl,
        fee: tradeFee,
        isWin,
      });

      dayMap.set(dayKey, existing);
    }

    // Calculate percentages and sort by date
    const dailyData: DailyPerformance[] = Array.from(dayMap.values())
      .map((day) => ({
        ...day,
        winPct: day.totalTrades > 0 ? Math.round((day.wins / day.totalTrades) * 100) : 0,
        lossPct: day.totalTrades > 0 ? Math.round((day.losses / day.totalTrades) * 100) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate overall statistics
    const totalWins = dailyData.reduce((sum, day) => sum + day.wins, 0);
    const totalLosses = dailyData.reduce((sum, day) => sum + day.losses, 0);
    const totalTrades = totalWins + totalLosses;
    const overallWinPct = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;
    const overallLossPct = totalTrades > 0 ? Math.round((totalLosses / totalTrades) * 100) : 0;

    // Calculate total profit (all PnL - all fees)
    const totalPnL = trades.reduce((sum, t) => {
      const pnl = t.pnl != null ? Number(t.pnl) : 0;
      return sum + pnl;
    }, 0);

    const totalFees = trades.reduce((sum, t) => {
      const fee = t.fee != null ? Number(t.fee) : 0;
      return sum + fee;
    }, 0);

    const totalProfit = totalPnL - totalFees; // All-time net profit

    const response: PerformanceResponse = {
      daily: dailyData,
      totalTrades,
      totalWins,
      totalLosses,
      overallWinPct,
      overallLossPct,
      totalProfit,
      totalPnL,
      totalFees,
    };

    console.log(`[Performance API] Calculated ${dailyData.length} days, ${totalTrades} total trades`);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
      },
    });
  } catch (error: any) {
    console.error("Error calculating dashboard performance:", error);
    // Return empty response instead of error to prevent component breakage
    return NextResponse.json({
      daily: [],
      totalTrades: 0,
      totalWins: 0,
      totalLosses: 0,
      overallWinPct: 0,
      overallLossPct: 0,
      totalProfit: 0,
      totalPnL: 0,
      totalFees: 0,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
      },
    });
  }
}

