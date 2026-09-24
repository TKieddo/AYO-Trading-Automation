import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

type FieldSpec =
  | { kind: "bool" }
  | { kind: "int"; min: number; max: number }
  | { kind: "num"; min: number; max: number; nullable?: boolean }
  | { kind: "enum"; values: string[] }
  | { kind: "text"; pattern?: RegExp; maxLength?: number };

/**
 * Every adaptive-risk knob the agent reads, with the range the dashboard will accept.
 * Anything absent from the request body is left untouched.
 */
const ADAPTIVE_RISK_FIELDS: Record<string, FieldSpec> = {
  // Volatility-adaptive exits
  exit_mode: { kind: "enum", values: ["atr", "fixed"] },
  // Take-profit independent of stop: roi_percent locks at TAKE_PROFIT_PERCENT margin ROI;
  // usd locks at TAKE_PROFIT_USD; atr_rr keeps legacy R-multiple of the ATR stop.
  tp_mode: { kind: "enum", values: ["roi_percent", "usd", "atr_rr"] },
  take_profit_usd: { kind: "num", min: 0.1, max: 100000, nullable: true },
  sl_atr_mult: { kind: "num", min: 0.5, max: 10 },
  tp_rr_ratio: { kind: "num", min: 0.5, max: 10 },
  atr_period: { kind: "int", min: 2, max: 200 },
  min_stop_price_pct: { kind: "num", min: 0.05, max: 20 },
  max_stop_price_pct: { kind: "num", min: 0.1, max: 50 },

  // Risk-based sizing
  risk_per_trade_usd: { kind: "num", min: 0.1, max: 100000, nullable: true },
  risk_per_trade_pct: { kind: "num", min: 0.01, max: 20 },
  max_notional_per_position: { kind: "num", min: 1, max: 10000000, nullable: true },
  min_notional_per_position: { kind: "num", min: 0, max: 1000000 },

  // Scale-out ladder
  enable_profit_ladder: { kind: "bool" },
  profit_ladder: { kind: "text", pattern: /^\s*(\d+(\.\d+)?\s*:\s*\d+(\.\d+)?\s*)(,\s*\d+(\.\d+)?\s*:\s*\d+(\.\d+)?\s*)*$/, maxLength: 200 },
  breakeven_after_first_fill: { kind: "bool" },
  enable_breakeven_stop: { kind: "bool" },
  breakeven_trigger_r: { kind: "num", min: 0.1, max: 10 },
  trailing_stop_activation_r: { kind: "num", min: 0.1, max: 20 },
  trailing_stop_distance_r: { kind: "num", min: 0.1, max: 20 },

  // Re-entry control
  reentry_cooldown_minutes: { kind: "num", min: 0, max: 10080 },
  loss_reentry_cooldown_minutes: { kind: "num", min: 0, max: 10080 },
  block_direction_flip: { kind: "bool" },

  // Circuit breakers
  max_daily_loss_usd: { kind: "num", min: 0, max: 1000000, nullable: true },
  max_daily_loss_pct: { kind: "num", min: 0, max: 100 },
  max_consecutive_losses: { kind: "int", min: 0, max: 100 },
  loss_streak_pause_minutes: { kind: "num", min: 0, max: 10080 },

  // Higher-timeframe trend filter
  enable_htf_trend_filter: { kind: "bool" },
  htf_trend_timeframe: { kind: "text", pattern: /^\d+[mhdw]$/i, maxLength: 8 },
  htf_trend_fast_ema: { kind: "int", min: 2, max: 400 },
  htf_trend_slow_ema: { kind: "int", min: 2, max: 400 },
  htf_trend_min_separation_pct: { kind: "num", min: 0, max: 20 },
  htf_block_when_flat: { kind: "bool" },

  // Analysis timeframes
  intraday_timeframe: { kind: "text", pattern: /^\d+[mhdw]$/i, maxLength: 8 },
  longterm_timeframe: { kind: "text", pattern: /^\d+[mhdw]$/i, maxLength: 8 },

  // Pair hunter
  pair_hunter_min_volatility: { kind: "num", min: 0, max: 50 },
  pair_hunter_ideal_volatility: { kind: "num", min: 0, max: 50 },
  pair_hunter_max_volatility: { kind: "num", min: 0, max: 100 },
  pair_hunter_min_volume_24h: { kind: "num", min: 0, max: 100000000000 },
  pair_hunter_min_trend_strength: { kind: "num", min: 0, max: 100 },
  pair_hunter_min_price: { kind: "num", min: 0, max: 100000 },
  pair_hunter_max_spread_pct: { kind: "num", min: 0, max: 10 },
  pair_hunter_timeframe: { kind: "text", pattern: /^\d+[mhdw]$/i, maxLength: 8 },
  pair_hunter_blacklist: { kind: "text", maxLength: 2000 },
  pair_hunter_weight_volatility: { kind: "num", min: 0, max: 1 },
  pair_hunter_weight_trend: { kind: "num", min: 0, max: 1 },
  pair_hunter_weight_setup: { kind: "num", min: 0, max: 1 },
};

function applyAdaptiveRiskFields(
  body: Record<string, any>,
  updateData: Record<string, any>
): { error?: string } {
  for (const [key, spec] of Object.entries(ADAPTIVE_RISK_FIELDS)) {
    const value = body[key];
    if (value === undefined) continue;

    if (spec.kind === "bool") {
      updateData[key] = Boolean(value);
      continue;
    }

    if (spec.kind === "enum") {
      const str = String(value).trim();
      if (!spec.values.includes(str)) {
        return { error: `${key} must be one of: ${spec.values.join(", ")}` };
      }
      updateData[key] = str;
      continue;
    }

    if (spec.kind === "text") {
      const str = String(value).trim();
      if (spec.maxLength && str.length > spec.maxLength) {
        return { error: `${key} must be at most ${spec.maxLength} characters` };
      }
      if (spec.pattern && str !== "" && !spec.pattern.test(str)) {
        return { error: `${key} has an invalid format: "${str}"` };
      }
      updateData[key] = str;
      continue;
    }

    // Numeric kinds
    if (value === null || value === "") {
      if (spec.kind === "num" && spec.nullable) {
        updateData[key] = null;
        continue;
      }
      return { error: `${key} cannot be empty` };
    }

    const num = Number(value);
    if (!Number.isFinite(num)) {
      return { error: `${key} must be a number` };
    }
    if (num < spec.min || num > spec.max) {
      return { error: `${key} must be between ${spec.min} and ${spec.max}` };
    }
    updateData[key] = spec.kind === "int" ? Math.round(num) : num;
  }

  // Cross-field checks the individual ranges cannot catch.
  const minStop = updateData.min_stop_price_pct;
  const maxStop = updateData.max_stop_price_pct;
  if (minStop !== undefined && maxStop !== undefined && Number(minStop) >= Number(maxStop)) {
    return { error: "min_stop_price_pct must be less than max_stop_price_pct" };
  }

  const fastEma = updateData.htf_trend_fast_ema;
  const slowEma = updateData.htf_trend_slow_ema;
  if (fastEma !== undefined && slowEma !== undefined && Number(fastEma) >= Number(slowEma)) {
    return { error: "htf_trend_fast_ema must be less than htf_trend_slow_ema" };
  }

  if (typeof updateData.profit_ladder === "string" && updateData.profit_ladder !== "") {
    const total = updateData.profit_ladder
      .split(",")
      .reduce((sum: number, rung: string) => sum + Number(rung.split(":")[1] ?? 0), 0);
    if (total > 100) {
      return { error: `profit_ladder rungs total ${total}% of the position; must not exceed 100%` };
    }
  }

  return {};
}

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
      // Volatility-adaptive exits
      exit_mode: "atr",
      tp_mode: "roi_percent",
      take_profit_usd: null,
      sl_atr_mult: 2.5,
      tp_rr_ratio: 2.0,
      atr_period: 14,
      min_stop_price_pct: 0.8,
      max_stop_price_pct: 5.0,
      // Risk-based sizing
      risk_per_trade_usd: null,
      risk_per_trade_pct: 0.5,
      max_notional_per_position: null,
      min_notional_per_position: 100,
      // Scale-out ladder
      enable_profit_ladder: true,
      profit_ladder: "1.0:50,2.0:30",
      breakeven_after_first_fill: true,
      enable_breakeven_stop: true,
      breakeven_trigger_r: 1.0,
      trailing_stop_activation_r: 1.5,
      trailing_stop_distance_r: 1.0,
      // Re-entry control
      reentry_cooldown_minutes: 45,
      loss_reentry_cooldown_minutes: 90,
      block_direction_flip: true,
      // Circuit breakers
      max_daily_loss_usd: null,
      max_daily_loss_pct: 3.0,
      max_consecutive_losses: 4,
      loss_streak_pause_minutes: 120,
      // Higher-timeframe trend filter
      enable_htf_trend_filter: true,
      htf_trend_timeframe: "1h",
      htf_trend_fast_ema: 20,
      htf_trend_slow_ema: 50,
      htf_trend_min_separation_pct: 0.15,
      htf_block_when_flat: true,
      // Analysis timeframes
      intraday_timeframe: "15m",
      longterm_timeframe: "4h",
      // Pair hunter
      pair_hunter_min_volatility: 1.0,
      pair_hunter_ideal_volatility: 2.0,
      pair_hunter_max_volatility: 3.5,
      pair_hunter_min_volume_24h: 50000000,
      pair_hunter_min_trend_strength: 25,
      pair_hunter_min_price: 0.01,
      pair_hunter_max_spread_pct: 0.5,
      pair_hunter_timeframe: "15m",
      pair_hunter_blacklist: "SHIB PEPE FLOKI BONK WIF MEME DOGE 1000SATS LUNA FTT",
      pair_hunter_weight_volatility: 0.25,
      pair_hunter_weight_trend: 0.4,
      pair_hunter_weight_setup: 0.35,
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

    if (stop_loss_percent !== undefined && (stop_loss_percent < 0.1 || stop_loss_percent > 100)) {
      return NextResponse.json(
        { error: "Stop loss percent must be between 0.1 and 100" },
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

    if (position_sizing_mode !== undefined && !["auto", "fixed", "target_profit", "margin", "risk"].includes(position_sizing_mode)) {
      return NextResponse.json(
        { error: "Position sizing mode must be 'auto', 'fixed', 'target_profit', 'margin', or 'risk'" },
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

    if (exchange !== undefined && !["binance", "aster", "okx", "ig", "alpaca"].includes(exchange)) {
      return NextResponse.json(
        { error: "Exchange must be 'binance', 'aster', 'okx', 'ig', or 'alpaca'" },
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

    // Adaptive risk fields. Declared as a table so adding a knob does not mean adding
    // three more near-identical blocks; ranges are enforced here rather than in the agent.
    const applied = applyAdaptiveRiskFields(body, updateData);
    if (applied.error) {
      return NextResponse.json({ error: applied.error }, { status: 400 });
    }

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

