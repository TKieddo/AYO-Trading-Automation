import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Save order metrics and fees/profit summary to database.
 * This endpoint is called to persist calculated metrics for historical tracking.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Supabase service role missing" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      orderMetrics,
      feesAndProfit,
      timestamp = new Date().toISOString(),
    } = body;

    if (!orderMetrics || !feesAndProfit) {
      return NextResponse.json({ error: "orderMetrics and feesAndProfit required" }, { status: 400 });
    }

    // Save to order_metrics_summary table using the upsert function
    try {
      await sb.rpc("upsert_order_metrics_summary", {
        p_timestamp: new Date(timestamp).toISOString(),
        p_total_orders: orderMetrics.total || 0,
        p_open_orders: orderMetrics.open || 0,
        p_filled_orders: orderMetrics.filled || 0,
        p_canceled_orders: orderMetrics.canceled || 0,
        p_rejected_orders: orderMetrics.rejected || 0,
        p_total_fees: feesAndProfit.totalFees || 0,
        p_total_pnl: feesAndProfit.totalPnL || 0,
        p_net_profit: feesAndProfit.netProfit || 0,
        p_avg_fee_per_trade: feesAndProfit.avgFeePerTrade || 0,
        p_fee_to_pnl_ratio: feesAndProfit.feeToPnLRatio || 0,
        p_profit_margin: feesAndProfit.profitMargin || 0,
      });
      
      return NextResponse.json({ ok: true, saved: true });
    } catch (rpcError: any) {
      // If function doesn't exist (migration not run), fallback to account_metrics
      console.warn("order_metrics_summary table not available, using account_metrics:", rpcError.message);
      
      const metricsData = {
        total_pnl: feesAndProfit.totalPnL || 0,
        daily_pnl: 0,
        total_trades: 0,
        timestamp: new Date(timestamp).toISOString(),
      };
      
      await sb.from("account_metrics").insert(metricsData).catch(() => {
        // Ignore duplicate timestamp errors
      });
      
      return NextResponse.json({ ok: true, saved: true, fallback: true });
    }
  } catch (error: any) {
    console.error("Error saving order metrics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save metrics" },
      { status: 500 }
    );
  }
}

/**
 * Get historical order metrics and fees/profit data
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Supabase service role missing" }, { status: 500 });
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");

    // Fetch from account_metrics or dedicated table
    const { data, error } = await sb
      .from("account_metrics")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({ metrics: data || [] });
  } catch (error: any) {
    console.error("Error fetching order metrics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}

