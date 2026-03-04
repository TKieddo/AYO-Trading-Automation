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
      multi_exchange_mode: false,
      assets: "BTC ETH SOL",
      interval: "5m",
      strategy: "auto",
      exchange: "binance",
      alert_service_enabled: false,
      alert_risk_per_trade: 30.0,
      alert_check_interval: 5,
      alert_agent_endpoint: "http://localhost:5000/api/alert/signal",
      alert_assets: "ZEC,BTC,ETH,SOL,BNB",
      alert_timeframe: "15m",
      enable_trailing_stop: true,
      trailing_stop_activation_pct: 5.0,
      trailing_stop_distance_pct: 3.0,
      max_position_hold_hours: 48.0,
      enable_drawdown_protection: true,
      max_drawdown_from_peak_pct: 5.0,
      scalping_tp_percent: 5.0,
      scalping_sl_percent: 5.0,
      auto_strategy_cache_minutes: 0,
      asset_leverage_overrides: {},
      asset_timeframes: {},
      llm_model: "deepseek-reasoner",
      deepseek_max_tokens: 20000,
      next_public_base_url: "http://localhost:3001",
      stop_loss_usd: null,
      take_profit_strict_enforcement: false,
      enable_stop_loss_orders: true,
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
      active_strategy_ids,
      multi_exchange_mode,
      assets,
      interval,
      strategy,
      exchange,
      alert_service_enabled,
      alert_risk_per_trade,
      alert_check_interval,
      alert_agent_endpoint,
      alert_assets,
      alert_timeframe,
      enable_trailing_stop,
      trailing_stop_activation_pct,
      trailing_stop_distance_pct,
      max_position_hold_hours,
      enable_drawdown_protection,
      max_drawdown_from_peak_pct,
      scalping_tp_percent,
      scalping_sl_percent,
      auto_strategy_cache_minutes,
      asset_leverage_overrides,
      asset_timeframes,
      llm_model,
      deepseek_max_tokens,
      next_public_base_url,
      stop_loss_usd,
      take_profit_strict_enforcement,
      enable_stop_loss_orders
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

    if (stop_loss_usd !== undefined && stop_loss_usd !== null && (stop_loss_usd >= 0 || stop_loss_usd < -100000)) {
      return NextResponse.json(
        { error: "Stop loss USD must be negative and between -100000 and 0 (e.g., -18)" },
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

    // Validate new fields
    if (interval !== undefined && !/^\d+[mhd]$/i.test(interval)) {
      return NextResponse.json(
        { error: "Interval must be in format like '5m', '1h', '1d'" },
        { status: 400 }
      );
    }

    if (strategy !== undefined && strategy !== "" && !["auto", "scalping", "llm_trend", "default"].includes(strategy)) {
      return NextResponse.json(
        { error: "Strategy must be 'auto', 'scalping', 'llm_trend', or 'default'" },
        { status: 400 }
      );
    }

    if (exchange !== undefined && !["binance", "aster"].includes(exchange)) {
      return NextResponse.json(
        { error: "Exchange must be 'binance' or 'aster'" },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Existing fields
    if (leverage !== undefined) updateData.leverage = Math.round(leverage);
    if (take_profit_percent !== undefined) updateData.take_profit_percent = Number(take_profit_percent);
    if (stop_loss_percent !== undefined) updateData.stop_loss_percent = Number(stop_loss_percent);
    if (target_profit_per_1pct_move !== undefined) updateData.target_profit_per_1pct_move = Number(target_profit_per_1pct_move);
    if (allocation_per_position !== undefined) updateData.allocation_per_position = allocation_per_position === null || allocation_per_position === "" ? null : Number(allocation_per_position);
    if (margin_per_position !== undefined) updateData.margin_per_position = margin_per_position === null || margin_per_position === "" ? null : Number(margin_per_position);
    if (max_positions !== undefined) updateData.max_positions = Math.round(max_positions);
    if (position_sizing_mode !== undefined) updateData.position_sizing_mode = position_sizing_mode;
    if (active_strategy_ids !== undefined) updateData.active_strategy_ids = Array.isArray(active_strategy_ids) ? active_strategy_ids : [];

    // New fields
    if (multi_exchange_mode !== undefined) updateData.multi_exchange_mode = Boolean(multi_exchange_mode);
    if (assets !== undefined) updateData.assets = String(assets).trim();
    if (interval !== undefined) updateData.interval = String(interval).trim();
    if (strategy !== undefined) updateData.strategy = strategy === "" ? null : String(strategy).trim();
    if (exchange !== undefined) updateData.exchange = String(exchange).trim();
    if (alert_service_enabled !== undefined) updateData.alert_service_enabled = Boolean(alert_service_enabled);
    if (alert_risk_per_trade !== undefined) updateData.alert_risk_per_trade = Number(alert_risk_per_trade);
    if (alert_check_interval !== undefined) updateData.alert_check_interval = Math.round(alert_check_interval);
    if (alert_agent_endpoint !== undefined) updateData.alert_agent_endpoint = String(alert_agent_endpoint).trim();
    if (alert_assets !== undefined) updateData.alert_assets = String(alert_assets).trim();
    if (alert_timeframe !== undefined) updateData.alert_timeframe = String(alert_timeframe).trim();
    if (enable_trailing_stop !== undefined) updateData.enable_trailing_stop = Boolean(enable_trailing_stop);
    if (trailing_stop_activation_pct !== undefined) updateData.trailing_stop_activation_pct = Number(trailing_stop_activation_pct);
    if (trailing_stop_distance_pct !== undefined) updateData.trailing_stop_distance_pct = Number(trailing_stop_distance_pct);
    if (max_position_hold_hours !== undefined) updateData.max_position_hold_hours = Number(max_position_hold_hours);
    if (enable_drawdown_protection !== undefined) updateData.enable_drawdown_protection = Boolean(enable_drawdown_protection);
    if (max_drawdown_from_peak_pct !== undefined) updateData.max_drawdown_from_peak_pct = Number(max_drawdown_from_peak_pct);
    if (scalping_tp_percent !== undefined) updateData.scalping_tp_percent = Number(scalping_tp_percent);
    if (scalping_sl_percent !== undefined) updateData.scalping_sl_percent = Number(scalping_sl_percent);
    if (auto_strategy_cache_minutes !== undefined) updateData.auto_strategy_cache_minutes = Math.round(auto_strategy_cache_minutes);
    if (asset_leverage_overrides !== undefined) updateData.asset_leverage_overrides = typeof asset_leverage_overrides === 'object' ? asset_leverage_overrides : {};
    if (asset_timeframes !== undefined) updateData.asset_timeframes = typeof asset_timeframes === 'object' ? asset_timeframes : {};
    if (llm_model !== undefined) updateData.llm_model = String(llm_model).trim();
    if (deepseek_max_tokens !== undefined) updateData.deepseek_max_tokens = Math.round(deepseek_max_tokens);
    if (next_public_base_url !== undefined) updateData.next_public_base_url = String(next_public_base_url).trim();
    if (stop_loss_usd !== undefined) updateData.stop_loss_usd = stop_loss_usd === null || stop_loss_usd === "" ? null : Number(stop_loss_usd);
    if (take_profit_strict_enforcement !== undefined) updateData.take_profit_strict_enforcement = Boolean(take_profit_strict_enforcement);
    if (enable_stop_loss_orders !== undefined) updateData.enable_stop_loss_orders = Boolean(enable_stop_loss_orders);

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

