import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/trading/optimize
 * Start strategy optimization
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      strategy_id,
      backtest_id,
      target_profitability,
      max_iterations,
      optimization_method,
      parameters_to_optimize,
    } = body;

    // Validate inputs
    if (!strategy_id || !backtest_id || !target_profitability) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get original backtest result
    const { data: backtest, error: backtestError } = await supabase
      .from("backtest_results")
      .select("total_return")
      .eq("id", backtest_id)
      .single();

    if (backtestError || !backtest) {
      return NextResponse.json(
        { error: "Backtest not found" },
        { status: 404 }
      );
    }

    // Create optimization record
    const { data: optimization, error: optError } = await supabase
      .from("strategy_optimizations")
      .insert({
        strategy_id,
        original_backtest_id: backtest_id,
        target_profitability: Number(target_profitability),
        original_profitability: backtest.total_return,
        max_iterations: Number(max_iterations) || 50,
        optimization_method: optimization_method || "llm_guided",
        status: "pending",
        parameters_tested: [],
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (optError) {
      console.error("Error creating optimization:", optError);
      return NextResponse.json(
        { error: optError.message || "Failed to create optimization" },
        { status: 500 }
      );
    }

    // TODO: Trigger Python optimization process
    // This would call your Python backtesting/optimization service
    // For now, we'll just return the optimization record

    return NextResponse.json({
      success: true,
      optimization: optimization,
      message: "Optimization started",
    });
  } catch (error: any) {
    console.error("Error starting optimization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start optimization" },
      { status: 500 }
    );
  }
}

