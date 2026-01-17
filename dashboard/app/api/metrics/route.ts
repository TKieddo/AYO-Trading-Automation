import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { getServerSupabase } from "@/lib/supabase/server";
import { fetchJsonWithRetry } from "@/lib/http";
import { persistMetrics } from "@/lib/supabase/persist";

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

/**
 * Calculate daily PNL from trades executed today
 */
function calculateDailyPnL(trades: any[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  return trades
    .filter((t: any) => {
      const tradeDate = new Date(t.executed_at || t.timestamp);
      return tradeDate >= today;
    })
    .reduce((sum: number, trade: any) => {
      const pnl = trade.pnl != null ? Number(trade.pnl) : 0;
      const fee = trade.fee != null ? Number(trade.fee) : 0;
      return sum + pnl - fee; // Net PNL after fees
    }, 0);
}

/**
 * Calculate total realized PNL from all trades
 */
function calculateTotalRealizedPnL(trades: any[]): number {
  return trades.reduce((sum: number, trade: any) => {
    const pnl = trade.pnl != null ? Number(trade.pnl) : 0;
    const fee = trade.fee != null ? Number(trade.fee) : 0;
    return sum + pnl - fee; // Net PNL after fees
  }, 0);
}

/**
 * Calculate win rate from trades
 */
function calculateWinRate(trades: any[]): number {
  const tradesWithPnl = trades.filter((t: any) => {
    const pnl = t.pnl;
    return pnl != null && typeof pnl === 'number' && !isNaN(pnl) && isFinite(pnl);
  });
  
  if (tradesWithPnl.length === 0) return 0;
  
  const wins = tradesWithPnl.filter((t: any) => {
    const pnl = t.pnl != null ? Number(t.pnl) : 0;
    const fee = t.fee != null ? Number(t.fee) : 0;
    return (pnl - fee) > 0; // Net profit after fees
  });
  
  return (wins.length / tradesWithPnl.length) * 100;
}

export async function GET() {
  try {
    // Fetch account status from Python agent
    const [statusResponse, positionsResponse] = await Promise.allSettled([
      fetchJsonWithRetry<any>(`${BASE}/agent/status`, { timeoutMs: 20000, cache: "no-store" }, 2, 300),
      fetchJsonWithRetry<any[]>(`${BASE}/agent/positions`, { timeoutMs: 20000, cache: "no-store" }, 2, 300),
    ]);

    let accountValue = 0;
    let balance = 0;
    let openPositions = 0;
    let unrealizedPnL = 0;

    // Extract account data from status
    if (statusResponse.status === 'fulfilled') {
      const status = statusResponse.value;
      accountValue = Number(status.account_value || status.accountValue || 0);
      balance = Number(status.balance || 0);
      openPositions = Number(status.positions_count || status.positionsCount || 0);
    }

    // Extract positions data and calculate unrealized PNL
    if (positionsResponse.status === 'fulfilled') {
      const positions = Array.isArray(positionsResponse.value) ? positionsResponse.value : [];
      openPositions = positions.length; // Use actual positions count
      unrealizedPnL = positions.reduce((sum: number, pos: any) => {
        const pnl = pos.unrealizedPnl != null ? Number(pos.unrealizedPnl) : 
                   (pos.unrealized_pnl != null ? Number(pos.unrealized_pnl) : 
                   (pos.pnl != null ? Number(pos.pnl) : 0));
        return sum + pnl;
      }, 0);
    }

    // Fetch trades from Supabase to calculate realized PNL
    let realizedPnL = 0;
    let dailyPnL = 0;
    let totalTrades = 0;
    let winRate = 0;

    try {
      const supabase = getServerSupabase();
      if (supabase) {
        const { data: trades, error } = await supabase
          .from("trades")
          .select("executed_at, pnl, fee")
          .order("executed_at", { ascending: false });

        if (!error && Array.isArray(trades)) {
          totalTrades = trades.length;
          realizedPnL = calculateTotalRealizedPnL(trades);
          dailyPnL = calculateDailyPnL(trades);
          winRate = calculateWinRate(trades);
        }
      }
    } catch (e) {
      console.error("Failed to fetch trades from Supabase:", e);
    }

    // Calculate total PNL (realized + unrealized)
    const totalPnL = realizedPnL + unrealizedPnL;

    // Calculate leverage (estimate from positions if available)
    let leverage = 1.0;
    if (positionsResponse.status === 'fulfilled') {
      const positions = Array.isArray(positionsResponse.value) ? positionsResponse.value : [];
      if (positions.length > 0 && accountValue > 0) {
        // Calculate total notional value of positions
        const totalNotional = positions.reduce((sum: number, pos: any) => {
          const size = Math.abs(Number(pos.size || 0));
          const currentPrice = Number(pos.currentPrice || pos.current_price || 0);
          return sum + (size * currentPrice);
        }, 0);
        leverage = totalNotional > 0 ? totalNotional / accountValue : 1.0;
      }
    }

    const metrics = {
      totalValue: accountValue,
      balance: balance,
      openPositions: openPositions,
      totalPnL: totalPnL,
      dailyPnL: dailyPnL,
      winRate: winRate,
      totalTrades: totalTrades,
      leverage: leverage,
    };

    // Persist the metrics
    persistMetrics(metrics).catch(() => {});
    
    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {

    // Silently handle connection errors - Python agent may not be running
    if (error.code !== 'ECONNREFUSED' && !error.message?.includes('fetch failed')) {
      console.error("Failed to fetch metrics:", error);
    }
  }

  // Fallback to Supabase latest metrics
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("account_metrics")
        .select(
          "total_value, balance, open_positions, total_pnl, daily_pnl, win_rate, total_trades, leverage, timestamp"
        )
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const result = (data as any)
        ? {
            totalValue: Number((data as any).total_value),
            balance: Number((data as any).balance),
            openPositions: Number((data as any).open_positions),
            totalPnL: Number((data as any).total_pnl),
            dailyPnL: Number((data as any).daily_pnl),
            winRate: Number((data as any).win_rate),
            totalTrades: Number((data as any).total_trades),
            leverage: Number((data as any).leverage),
          }
        : null;

      if (result) return NextResponse.json(result);
    }
  } catch (e) {
    console.error("Failed to fetch account metrics from Supabase:", e);
  }

  // Final fallback: return zeros
  return NextResponse.json({
    totalValue: 0,
    balance: 0,
    openPositions: 0,
    totalPnL: 0,
    dailyPnL: 0,
    winRate: 0,
    totalTrades: 0,
    leverage: 1,
  });
}
