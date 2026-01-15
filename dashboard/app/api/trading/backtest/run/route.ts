import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/trading/backtest/run
 * Run a backtest for a strategy
 * 
 * This endpoint triggers the Python backtesting engine
 * TODO: Connect to Python backtesting service
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
      symbol,
      timeframe,
      start_date,
      end_date,
      initial_capital,
    } = body;

    // Validate inputs
    if (!strategy_id || !symbol || !timeframe || !start_date || !end_date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get strategy details
    const { data: strategy, error: strategyError } = await supabase
      .from("strategies")
      .select("*")
      .eq("id", strategy_id)
      .single();

    if (strategyError || !strategy) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    // Call Python backtesting engine
    const pythonApiUrl = process.env.PYTHON_BACKTEST_API_URL || "http://localhost:8000";
    
    try {
      // Get strategy JSON
      const strategyJson = strategy.strategy_json || {
        name: strategy.name,
        description: strategy.description,
        rsi_period: 14,
        ema_fast: 20,
        ema_slow: 50,
        take_profit: 5.0,
        stop_loss: 3.0,
      };

      // Call Python backtest API
      const backtestResponse = await fetch(`${pythonApiUrl}/backtest/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy_id,
          strategy_json: strategyJson,
          symbol,
          timeframe,
          start_date,
          end_date,
          initial_capital: initial_capital || 300,
        }),
      });

      if (!backtestResponse.ok) {
        const errorText = await backtestResponse.text();
        throw new Error(`Python backtest API error: ${errorText}`);
      }

      const backtestResult = await backtestResponse.json();

      // Save to database
      const { data: savedResult, error: saveError } = await supabase
        .from("backtest_results")
        .insert({
          strategy_id,
          strategy_name: strategy.name,
          symbol,
          timeframe,
          start_date,
          end_date,
          initial_capital: backtestResult.initial_capital || initial_capital || 300,
          final_capital: backtestResult.final_capital || initial_capital || 300,
          total_return: backtestResult.total_return || 0,
          buy_and_hold_return: backtestResult.buy_and_hold_return || 0,
          sharpe_ratio: backtestResult.sharpe_ratio || 0,
          sortino_ratio: backtestResult.sortino_ratio || 0,
          max_drawdown: backtestResult.max_drawdown || 0,
          win_rate: backtestResult.win_rate || 0,
          profit_factor: backtestResult.profit_factor || 0,
          expectancy: backtestResult.expectancy || 0,
          total_trades: backtestResult.total_trades || 0,
          winning_trades: backtestResult.winning_trades || 0,
          losing_trades: backtestResult.losing_trades || 0,
          avg_hold_time_hours: backtestResult.avg_hold_time_hours || 0,
          metrics_json: backtestResult,
        })
        .select()
        .single();

      if (saveError) {
        console.error("Error saving backtest result:", saveError);
        return NextResponse.json(
          { error: saveError.message || "Failed to save backtest result" },
          { status: 500 }
        );
      }

      // Update strategy status to "backtested"
      await supabase
        .from("strategies")
        .update({ status: "backtested", updated_at: new Date().toISOString() })
        .eq("id", strategy_id);

      return NextResponse.json({
        success: true,
        message: "Backtest completed successfully with real data!",
        result: savedResult,
      });

    } catch (pythonError: any) {
      console.error("Python backtest API error:", pythonError);
      // Fallback: Return error but don't fail completely
      return NextResponse.json(
        {
          error: `Backtest execution failed: ${pythonError.message}. Make sure Python backtest server is running on port 8000.`,
          note: "Start the Python backtest server: python src/api/backtest_server.py",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error running backtest:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run backtest" },
      { status: 500 }
    );
  }
}

