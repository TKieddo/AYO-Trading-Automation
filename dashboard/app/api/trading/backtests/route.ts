import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/trading/backtests
 * Fetch all backtest results
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 500 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");
    const strategyId = searchParams.get("strategy_id");

    let query = supabase
      .from("backtest_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (strategyId) {
      query = query.eq("strategy_id", strategyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching backtest results:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch backtest results" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      results: data || [],
    });
  } catch (error: any) {
    console.error("Error fetching backtest results:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch backtest results" },
      { status: 500 }
    );
  }
}

