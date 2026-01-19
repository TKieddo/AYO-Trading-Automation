import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

type TradeRecord = {
  symbol: string;
  side: string;
  size: string | number;
  price: string | number;
  fee: string | number | null;
  pnl: string | number | null;
  executed_at: string;
};

/**
 * Backfill existing trades to portfolio_activities table
 * This endpoint syncs all trades with PnL to portfolio_activities
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Get all trades with PnL
    const { data: tradesData, error: tradesError } = await sb
      .from("trades")
      .select("symbol, side, size, price, fee, pnl, executed_at")
      .not("pnl", "is", null)
      .order("executed_at", { ascending: true });

    if (tradesError) throw tradesError;

    // Type the query results explicitly
    const trades: TradeRecord[] = (tradesData || []) as TradeRecord[];

    if (!trades || trades.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No trades with PnL found",
        synced: 0,
      });
    }

    const activitiesToSave: any[] = [];
    const now = new Date().toISOString();

    for (const trade of trades) {
      const pnl = Number(trade.pnl || 0);
      const fee = Number(trade.fee || 0);
      const tradeId = `${trade.symbol}_${trade.side}_${new Date(trade.executed_at).getTime()}_${trade.price}_${trade.size}`;

      // Save PnL as trade_pnl activity
      activitiesToSave.push({
        type: "trade_pnl",
        amount: pnl.toString(),
        symbol: trade.symbol,
        description: `Trade P&L: ${trade.symbol} ${trade.side}`,
        timestamp: trade.executed_at,
        income_id: `trade_pnl_${tradeId}`,
        synced_at: now,
      });

      // Save fee as commission activity if > 0
      if (fee > 0) {
        activitiesToSave.push({
          type: "commission",
          amount: (-fee).toString(), // Negative because it's a cost
          symbol: trade.symbol,
          description: `Trading commission: ${trade.symbol} ${trade.side}`,
          timestamp: trade.executed_at,
          income_id: `commission_${tradeId}`,
          synced_at: now,
        });
      }
    }

    // Upsert to portfolio_activities
    // Handle partial unique index by inserting individually
    if (activitiesToSave.length > 0) {
      let successCount = 0;
      for (const activity of activitiesToSave) {
        try {
          const { error } = await sb
            .from("portfolio_activities")
            .upsert(activity as any, {
              onConflict: "income_id",
              ignoreDuplicates: false,
            });
          if (!error) {
            successCount++;
          } else if (error.code !== '23505' && error.code !== '42P10') {
            // Only log non-duplicate errors
            console.error("Error upserting portfolio activity:", error);
          }
        } catch (err: any) {
          // Ignore duplicate errors (23505 is unique constraint violation, 42P10 is constraint mismatch)
          if (err.code !== '23505' && err.code !== '42P10') {
            console.error("Error upserting portfolio activity:", err);
          }
        }
      }
      if (successCount < activitiesToSave.length) {
        console.log(`Synced ${successCount} of ${activitiesToSave.length} activities (some may be duplicates)`);
      }
    }

    return NextResponse.json({
      success: true,
      synced: activitiesToSave.length,
      tradesProcessed: trades.length,
    });
  } catch (error: any) {
    console.error("Error syncing trades to portfolio_activities:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to sync trades to portfolio_activities",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Check sync status
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Count trades with PnL
    const { count: tradesCount } = await sb
      .from("trades")
      .select("*", { count: "exact", head: true })
      .not("pnl", "is", null);

    // Count portfolio activities
    const { count: activitiesCount } = await sb
      .from("portfolio_activities")
      .select("*", { count: "exact", head: true })
      .eq("type", "trade_pnl");

    return NextResponse.json({
      tradesWithPnL: tradesCount || 0,
      tradeActivities: activitiesCount || 0,
      needsSync: (tradesCount || 0) > (activitiesCount || 0),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to check sync status",
      },
      { status: 500 }
    );
  }
}

