import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/trading/settings
 * Fetch current trading settings (leverage, TP%, SL%)
 */
export async function GET() {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("trading_settings")
      .select("*")
      .eq("id", "default")
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = not found, which is okay (we'll use defaults)
      console.error("Error fetching trading settings:", error);
    }

    // Return settings or defaults
    const settings = data || {
      id: "default",
      leverage: 10,
      take_profit_percent: 5.0,
      stop_loss_percent: 3.0,
      target_profit_per_1pct_move: 1.0,
      allocation_per_position: null,
      margin_per_position: null,
      max_positions: 6,
      position_sizing_mode: "auto",
      active_strategy_ids: [],
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("Error fetching trading settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch trading settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trading/settings
 * Update trading settings (leverage, TP%, SL%)
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
      leverage, 
      take_profit_percent, 
      stop_loss_percent,
      target_profit_per_1pct_move,
      allocation_per_position,
      margin_per_position,
      max_positions,
      position_sizing_mode,
      active_strategy_ids
    } = body;

    // Validate inputs
    if (leverage !== undefined && (leverage < 1 || leverage > 100)) {
      return NextResponse.json(
        { error: "Leverage must be between 1 and 100" },
        { status: 400 }
      );
    }

    if (take_profit_percent !== undefined && (take_profit_percent < 0.1 || take_profit_percent > 100)) {
      return NextResponse.json(
        { error: "Take profit percent must be between 0.1 and 100" },
        { status: 400 }
      );
    }

    if (stop_loss_percent !== undefined && (stop_loss_percent < 0.1 || stop_loss_percent > 50)) {
      return NextResponse.json(
        { error: "Stop loss percent must be between 0.1 and 50" },
        { status: 400 }
      );
    }

    if (target_profit_per_1pct_move !== undefined && (target_profit_per_1pct_move < 0.01 || target_profit_per_1pct_move > 1000)) {
      return NextResponse.json(
        { error: "Target profit per 1% move must be between 0.01 and 1000" },
        { status: 400 }
      );
    }

    if (allocation_per_position !== undefined && allocation_per_position !== null && (allocation_per_position < 1 || allocation_per_position > 100000)) {
      return NextResponse.json(
        { error: "Allocation per position must be between 1 and 100000" },
        { status: 400 }
      );
    }

    if (max_positions !== undefined && (max_positions < 1 || max_positions > 50)) {
      return NextResponse.json(
        { error: "Max positions must be between 1 and 50" },
        { status: 400 }
      );
    }

    if (position_sizing_mode !== undefined && !["auto", "fixed", "target_profit", "margin"].includes(position_sizing_mode)) {
      return NextResponse.json(
        { error: "Position sizing mode must be 'auto', 'fixed', 'target_profit', or 'margin'" },
        { status: 400 }
      );
    }

    if (margin_per_position !== undefined && margin_per_position !== null && (margin_per_position < 1 || margin_per_position > 100000)) {
      return NextResponse.json(
        { error: "Margin per position must be between 1 and 100000" },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (leverage !== undefined) updateData.leverage = Math.round(leverage);
    if (take_profit_percent !== undefined) updateData.take_profit_percent = Number(take_profit_percent);
    if (stop_loss_percent !== undefined) updateData.stop_loss_percent = Number(stop_loss_percent);
    if (target_profit_per_1pct_move !== undefined) updateData.target_profit_per_1pct_move = Number(target_profit_per_1pct_move);
    if (allocation_per_position !== undefined) updateData.allocation_per_position = allocation_per_position === null || allocation_per_position === "" ? null : Number(allocation_per_position);
    if (margin_per_position !== undefined) updateData.margin_per_position = margin_per_position === null || margin_per_position === "" ? null : Number(margin_per_position);
    if (max_positions !== undefined) updateData.max_positions = Math.round(max_positions);
    if (position_sizing_mode !== undefined) updateData.position_sizing_mode = position_sizing_mode;
    if (active_strategy_ids !== undefined) updateData.active_strategy_ids = Array.isArray(active_strategy_ids) ? active_strategy_ids : [];

    // Upsert settings
    const { data, error } = await supabase
      .from("trading_settings")
      .upsert(
        {
          id: "default",
          ...updateData,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating trading settings:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update trading settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: data,
      message: "Trading settings updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating trading settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update trading settings" },
      { status: 500 }
    );
  }
}

