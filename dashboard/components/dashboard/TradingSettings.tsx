"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TradingSettings {
  leverage: number;
  take_profit_percent: number;
  stop_loss_percent: number;
  target_profit_per_1pct_move: number;
  allocation_per_position: number | null;
  margin_per_position: number | null;
  max_positions: number;
  position_sizing_mode: "auto" | "fixed" | "target_profit" | "margin";
  active_strategy_ids: string[];
  multi_exchange_mode: boolean;
  assets: string;
  interval: string;
  strategy: string;
  exchange: string;
  alert_service_enabled: boolean;
  alert_risk_per_trade: number;
  alert_check_interval: number;
  alert_agent_endpoint: string;
  alert_assets: string;
  alert_timeframe: string;
  enable_trailing_stop: boolean;
  trailing_stop_activation_pct: number;
  trailing_stop_distance_pct: number;
  max_position_hold_hours: number;
  enable_drawdown_protection: boolean;
  max_drawdown_from_peak_pct: number;
  scalping_tp_percent: number;
  scalping_sl_percent: number;
  auto_strategy_cache_minutes: number;
  asset_leverage_overrides: Record<string, number>;
  asset_timeframes: Record<string, string>;
  llm_model: string;
  deepseek_max_tokens: number;
  next_public_base_url: string;
  stop_loss_usd: number | null;
  take_profit_strict_enforcement: boolean;
}

export function TradingSettings() {
  const [settings, setSettings] = useState<TradingSettings>({
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
  });
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    setLoadingStrategies(true);
    try {
      const response = await fetch("/api/trading/strategies");
      if (response.ok) {
        const data = await response.json();
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error("Failed to fetch strategies:", error);
    } finally {
      setLoadingStrategies(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/trading/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          leverage: data.leverage || 10,
          take_profit_percent: data.take_profit_percent || 5.0,
          stop_loss_percent: data.stop_loss_percent || 3.0,
          target_profit_per_1pct_move: data.target_profit_per_1pct_move ?? 1.0,
          allocation_per_position: data.allocation_per_position ?? null,
          margin_per_position: data.margin_per_position ?? null,
          max_positions: data.max_positions ?? 6,
          position_sizing_mode: data.position_sizing_mode || "auto",
          active_strategy_ids: data.active_strategy_ids || [],
          multi_exchange_mode: data.multi_exchange_mode ?? false,
          assets: data.assets || "BTC ETH SOL",
          interval: data.interval || "5m",
          strategy: data.strategy || "auto",
          exchange: data.exchange || "binance",
          alert_service_enabled: data.alert_service_enabled ?? false,
          alert_risk_per_trade: data.alert_risk_per_trade ?? 30.0,
          alert_check_interval: data.alert_check_interval ?? 5,
          alert_agent_endpoint: data.alert_agent_endpoint || "http://localhost:5000/api/alert/signal",
          alert_assets: data.alert_assets || "ZEC,BTC,ETH,SOL,BNB",
          alert_timeframe: data.alert_timeframe || "15m",
          enable_trailing_stop: data.enable_trailing_stop ?? true,
          trailing_stop_activation_pct: data.trailing_stop_activation_pct ?? 5.0,
          trailing_stop_distance_pct: data.trailing_stop_distance_pct ?? 3.0,
          max_position_hold_hours: data.max_position_hold_hours ?? 48.0,
          enable_drawdown_protection: data.enable_drawdown_protection ?? true,
          max_drawdown_from_peak_pct: data.max_drawdown_from_peak_pct ?? 5.0,
          scalping_tp_percent: data.scalping_tp_percent ?? 5.0,
          scalping_sl_percent: data.scalping_sl_percent ?? 5.0,
          auto_strategy_cache_minutes: data.auto_strategy_cache_minutes ?? 0,
          stop_loss_usd: data.stop_loss_usd ?? null,
          take_profit_strict_enforcement: data.take_profit_strict_enforcement ?? false,
          asset_leverage_overrides: data.asset_leverage_overrides || {},
          asset_timeframes: data.asset_timeframes || {},
          llm_model: data.llm_model || "deepseek-reasoner",
          deepseek_max_tokens: data.deepseek_max_tokens ?? 20000,
          next_public_base_url: data.next_public_base_url || "http://localhost:3001",
        });
      }
    } catch (error) {
      console.error("Failed to fetch trading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/trading/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Settings saved successfully!" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save settings" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trading Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-slate-200 rounded"></div>
            <div className="h-10 bg-slate-200 rounded"></div>
            <div className="h-10 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Settings</CardTitle>
        <p className="text-sm text-slate-500">
          All settings are saved to the database and applied in real-time. No redeployment needed when changing trading pairs, leverage, or other parameters.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ============================================ */}
        {/* SECTION 1: TRADING CONFIGURATION */}
        {/* ============================================ */}
        <div className="space-y-4">
          <div className="pb-2 border-b-2 border-slate-300">
            <h3 className="text-lg font-bold text-slate-800">1. Trading Configuration</h3>
            <p className="text-xs text-slate-500 mt-1">Configure what assets to trade, timeframe, strategy, and exchange</p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assets" className="font-semibold">Assets to Trade (Trading Pairs)</Label>
              <Input
                id="assets"
                type="text"
                value={settings.assets}
                onChange={(e) => setSettings({ ...settings, assets: e.target.value })}
                placeholder="BTC ETH SOL BNB ZEC DOGE AVAX XLM XMR"
                className="w-full"
              />
              <p className="text-xs text-slate-500">Space-separated list of assets (e.g., "BTC ETH SOL"). You can add or remove pairs anytime.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interval" className="font-semibold">Trading Interval (Timeframe)</Label>
              <Input
                id="interval"
                type="text"
                value={settings.interval}
                onChange={(e) => setSettings({ ...settings, interval: e.target.value })}
                placeholder="5m"
                className="w-full"
              />
              <p className="text-xs text-slate-500">Timeframe for analysis (e.g., "5m", "15m", "1h", "1d")</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategy" className="font-semibold">Trading Strategy</Label>
              <select
                id="strategy"
                value={settings.strategy}
                onChange={(e) => setSettings({ ...settings, strategy: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c0e156]"
              >
                <option value="auto">Auto (LLM chooses best strategy)</option>
                <option value="scalping">Scalping</option>
                <option value="llm_trend">LLM Trend</option>
                <option value="default">Default</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exchange" className="font-semibold">Exchange</Label>
              <select
                id="exchange"
                value={settings.exchange}
                onChange={(e) => setSettings({ ...settings, exchange: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c0e156]"
              >
                <option value="binance">Binance</option>
                <option value="aster">Aster DEX</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="multi_exchange_mode"
                checked={settings.multi_exchange_mode}
                onChange={(e) => setSettings({ ...settings, multi_exchange_mode: e.target.checked })}
                className="w-4 h-4 text-[#c0e156] focus:ring-[#c0e156] rounded"
              />
              <Label htmlFor="multi_exchange_mode" className="font-semibold">Enable Multi-Exchange Mode</Label>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 2: POSITION SIZING & LEVERAGE */}
        {/* ============================================ */}
        <div className="pt-4 border-t-2 border-slate-300 space-y-4">
          <div className="pb-2 border-b-2 border-slate-300">
            <h3 className="text-lg font-bold text-slate-800">2. Position Sizing & Leverage</h3>
            <p className="text-xs text-slate-500 mt-1">Configure how much to risk per trade and leverage</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="leverage" className="font-semibold">
              Default Leverage
              <span className="text-xs text-slate-500 font-normal ml-2">(1-100x, will be capped by asset max)</span>
            </Label>
            <Input
              id="leverage"
              type="number"
              min="1"
              max="100"
              value={settings.leverage}
              onChange={(e) =>
                setSettings({ ...settings, leverage: parseInt(e.target.value) || 10 })
              }
              className="w-full"
            />
            <p className="text-xs text-slate-500">
              The AI will use the maximum allowed leverage for each asset if your setting exceeds it.
            </p>
          </div>

          {/* Position Sizing Mode */}
          
          <div className="space-y-2">
            <Label htmlFor="position_sizing_mode" className="font-semibold">
              Position Sizing Mode
            </Label>
            <select
              id="position_sizing_mode"
              value={settings.position_sizing_mode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  position_sizing_mode: e.target.value as "auto" | "fixed" | "target_profit" | "margin",
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c0e156]"
            >
              <option value="auto">Auto (Calculate from target profit)</option>
              <option value="target_profit">Target Profit (Calculate from target profit per 1% move)</option>
              <option value="fixed">Fixed (Use fixed allocation per position)</option>
              <option value="margin">Margin (Specify margin to risk, system calculates notional)</option>
            </select>
            <p className="text-xs text-slate-500">
              How the AI should calculate position sizes when placing trades.
            </p>
          </div>

          {(settings.position_sizing_mode === "auto" || settings.position_sizing_mode === "target_profit") && (
            <div className="space-y-2">
              <Label htmlFor="target_profit" className="flex items-center gap-2">
                Target Profit per 1% Move (USD)
                <span className="text-xs text-slate-500">(0.01-1000)</span>
              </Label>
              <Input
                id="target_profit"
                type="number"
                min="0.01"
                max="1000"
                step="0.01"
                value={settings.target_profit_per_1pct_move}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    target_profit_per_1pct_move: parseFloat(e.target.value) || 1.0,
                  })
                }
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                How much profit (in USD) you want to make when price moves 1%. The AI will calculate position size to achieve this.
                <br />
                Example: $1.00 means you want $1 profit on a 1% price move.
              </p>
            </div>
          )}

          {/* Fixed Allocation per Position */}
          {settings.position_sizing_mode === "fixed" && (
            <div className="space-y-2 mb-4">
              <Label htmlFor="allocation_per_position" className="flex items-center gap-2">
                Fixed Allocation per Position (USD)
                <span className="text-xs text-slate-500">(1-100000, leave empty for auto)</span>
              </Label>
              <Input
                id="allocation_per_position"
                type="number"
                min="1"
                max="100000"
                step="1"
                value={settings.allocation_per_position || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allocation_per_position: e.target.value === "" ? null : parseFloat(e.target.value) || null,
                  })
                }
                placeholder="Auto-calculate"
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Fixed USD amount to allocate per position. Leave empty to auto-calculate based on available balance and max positions.
              </p>
            </div>
          )}

          {settings.position_sizing_mode === "margin" && (
            <div className="space-y-2">
              <Label htmlFor="margin_per_position" className="flex items-center gap-2">
                Margin per Position (USD)
                <span className="text-xs text-slate-500">(1-100000, amount you risk per trade)</span>
              </Label>
              <Input
                id="margin_per_position"
                type="number"
                min="1"
                max="100000"
                step="0.01"
                value={settings.margin_per_position || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    margin_per_position: e.target.value === "" ? null : parseFloat(e.target.value) || null,
                  })
                }
                placeholder="Enter margin amount"
                className="w-full"
              />
              {settings.margin_per_position && settings.leverage && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs font-medium text-slate-700 mb-1">Calculated Notional Size:</p>
                  <p className="text-sm font-semibold text-slate-900">
                    ${(settings.margin_per_position * settings.leverage).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Formula: ${settings.margin_per_position.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} margin × {settings.leverage}x leverage
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Margin is the amount you risk per trade. The system will calculate the notional position size by multiplying margin by leverage. Example: $100 margin with 25x leverage = $2,500 notional position.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="max_positions" className="font-semibold">
              Maximum Concurrent Positions
              <span className="text-xs text-slate-500 font-normal ml-2">(1-50)</span>
            </Label>
            <Input
              id="max_positions"
              type="number"
              min="1"
              max="50"
              value={settings.max_positions}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  max_positions: parseInt(e.target.value) || 6,
                })
              }
              className="w-full"
            />
            <p className="text-xs text-slate-500">
              Maximum number of positions the AI can hold simultaneously. Recommended: 5-6 for $300 capital.
            </p>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 3: TAKE PROFIT & STOP LOSS */}
        {/* ============================================ */}
        <div className="pt-4 border-t-2 border-slate-300 space-y-4">
          <div className="pb-2 border-b-2 border-slate-300">
            <h3 className="text-lg font-bold text-slate-800">3. Take Profit & Stop Loss</h3>
            <p className="text-xs text-slate-500 mt-1">Configure exit conditions for positions</p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="take_profit" className="font-semibold">
                Take Profit Percentage
                <span className="text-xs text-slate-500 font-normal ml-2">(0.1-100%)</span>
              </Label>
              <Input
                id="take_profit"
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={settings.take_profit_percent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    take_profit_percent: parseFloat(e.target.value) || 5.0,
                  })
                }
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Percentage above entry price (long) or below entry price (short) to take profit.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stop_loss" className="font-semibold">
                Stop Loss Percentage
                <span className="text-xs text-slate-500 font-normal ml-2">(0.1-50%)</span>
              </Label>
              <Input
                id="stop_loss"
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={settings.stop_loss_percent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    stop_loss_percent: parseFloat(e.target.value) || 3.0,
                  })
                }
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Percentage below entry price (long) or above entry price (short) to stop loss. Higher values allow more room for reversals.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stop_loss_usd" className="font-semibold">
                Stop Loss (USD) - Optional
                <span className="text-xs text-slate-500 font-normal ml-2">(e.g., -18 for $18 max loss)</span>
              </Label>
              <Input
                id="stop_loss_usd"
                type="number"
                min="-10000"
                max="0"
                step="0.01"
                value={settings.stop_loss_usd ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    stop_loss_usd: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full"
                placeholder="Leave empty to use percentage only"
              />
              <p className="text-xs text-slate-500">
                Maximum loss in USD per position (negative value, e.g., -18 means close if loss reaches $18). 
                If set, position will close when EITHER percentage OR USD threshold is breached. Leave empty to use percentage only.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="take_profit_strict_enforcement"
                checked={settings.take_profit_strict_enforcement}
                onChange={(e) => setSettings({ ...settings, take_profit_strict_enforcement: e.target.checked })}
                className="w-4 h-4 text-[#c0e156] focus:ring-[#c0e156] rounded"
              />
              <Label htmlFor="take_profit_strict_enforcement" className="font-semibold">
                Strict Take Profit Enforcement
              </Label>
            </div>
            <p className="text-xs text-slate-500 ml-6">
              If checked, take profit percentage will be strictly enforced (close immediately when TP% is reached). 
              If unchecked, take profit will be guided by market conditions and indicators.
            </p>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 4: RISK MANAGEMENT */}
        {/* ============================================ */}
        <div className="pt-4 border-t-2 border-slate-300 space-y-4">
          <div className="pb-2 border-b-2 border-slate-300">
            <h3 className="text-lg font-bold text-slate-800">4. Risk Management</h3>
            <p className="text-xs text-slate-500 mt-1">Advanced risk controls and position protection</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enable_trailing_stop"
                checked={settings.enable_trailing_stop}
                onChange={(e) => setSettings({ ...settings, enable_trailing_stop: e.target.checked })}
                className="w-4 h-4 text-[#c0e156] focus:ring-[#c0e156] rounded"
              />
              <Label htmlFor="enable_trailing_stop">Enable Trailing Stop</Label>
            </div>

            {settings.enable_trailing_stop && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="trailing_stop_activation_pct">Trailing Stop Activation (%)</Label>
                  <Input
                    id="trailing_stop_activation_pct"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={settings.trailing_stop_activation_pct}
                    onChange={(e) => setSettings({ ...settings, trailing_stop_activation_pct: parseFloat(e.target.value) || 5.0 })}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Start trailing after X% profit</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trailing_stop_distance_pct">Trailing Stop Distance (%)</Label>
                  <Input
                    id="trailing_stop_distance_pct"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={settings.trailing_stop_distance_pct}
                    onChange={(e) => setSettings({ ...settings, trailing_stop_distance_pct: parseFloat(e.target.value) || 3.0 })}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Keep SL X% below peak profit</p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="max_position_hold_hours">Max Position Hold Time (hours)</Label>
              <Input
                id="max_position_hold_hours"
                type="number"
                min="0.1"
                step="0.1"
                value={settings.max_position_hold_hours}
                onChange={(e) => setSettings({ ...settings, max_position_hold_hours: parseFloat(e.target.value) || 48.0 })}
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enable_drawdown_protection"
                checked={settings.enable_drawdown_protection}
                onChange={(e) => setSettings({ ...settings, enable_drawdown_protection: e.target.checked })}
                className="w-4 h-4 text-[#c0e156] focus:ring-[#c0e156] rounded"
              />
              <Label htmlFor="enable_drawdown_protection">Enable Drawdown Protection</Label>
            </div>

            {settings.enable_drawdown_protection && (
              <div className="space-y-2">
                <Label htmlFor="max_drawdown_from_peak_pct">Max Drawdown from Peak (%)</Label>
                <Input
                  id="max_drawdown_from_peak_pct"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={settings.max_drawdown_from_peak_pct}
                  onChange={(e) => setSettings({ ...settings, max_drawdown_from_peak_pct: parseFloat(e.target.value) || 5.0 })}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 8: ACTIVE STRATEGIES */}
        {/* ============================================ */}
        <div className="pt-4 border-t-2 border-slate-300 space-y-4">
          <div className="pb-2 border-b-2 border-slate-300">
            <h3 className="text-lg font-bold text-slate-800">8. Active Trading Strategies</h3>
            <p className="text-xs text-slate-500 mt-1">Select which backtested strategies should be used in live trading</p>
          </div>
          
          {loadingStrategies ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : strategies.filter(s => s.status === "backtested").length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-sm text-slate-600">
                No backtested strategies available. Backtest a strategy first to enable it here.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {strategies
                .filter(s => s.status === "backtested")
                .map((strategy) => {
                  const isActive = settings.active_strategy_ids.includes(strategy.id);
                  return (
                    <label
                      key={strategy.id}
                      className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSettings({
                              ...settings,
                              active_strategy_ids: [...settings.active_strategy_ids, strategy.id],
                            });
                          } else {
                            setSettings({
                              ...settings,
                              active_strategy_ids: settings.active_strategy_ids.filter(
                                (id) => id !== strategy.id
                              ),
                            });
                          }
                        }}
                        className="mt-1 w-4 h-4 text-[#c0e156] focus:ring-[#c0e156] rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{strategy.name}</p>
                        {strategy.description && (
                          <p className="text-xs text-slate-500 mt-1">{strategy.description}</p>
                        )}
                      </div>
                      {isActive && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                          Active
                        </span>
                      )}
                    </label>
                  );
                })}
            </div>
          )}
          
          {settings.active_strategy_ids.length > 0 && (
            <p className="text-xs text-slate-500 mt-3">
              {settings.active_strategy_ids.length} strategy(ies) selected for live trading
            </p>
          )}
        </div>

        {/* ============================================ */}
        {/* SECTION 5: PINESCRIPT ALERT SERVICE */}
        {/* ============================================ */}
        <div className="pt-4 border-t-2 border-slate-300 space-y-4">
          <div className="pb-2 border-b-2 border-slate-300">
            <h3 className="text-lg font-bold text-slate-800">5. PineScript Alert Service</h3>
            <p className="text-xs text-slate-500 mt-1">Configure external PineScript alert monitoring</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="alert_service_enabled"
                checked={settings.alert_service_enabled}
                onChange={(e) => setSettings({ ...settings, alert_service_enabled: e.target.checked })}
                className="w-4 h-4 text-[#c0e156] focus:ring-[#c0e156] rounded"
              />
              <Label htmlFor="alert_service_enabled">Enable Alert Service</Label>
            </div>

            {settings.alert_service_enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="alert_assets">Alert Assets</Label>
                  <Input
                    id="alert_assets"
                    type="text"
                    value={settings.alert_assets}
                    onChange={(e) => setSettings({ ...settings, alert_assets: e.target.value })}
                    placeholder="ZEC,BTC,ETH,SOL,BNB"
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Comma-separated list of assets to monitor</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alert_timeframe">Alert Timeframe</Label>
                  <Input
                    id="alert_timeframe"
                    type="text"
                    value={settings.alert_timeframe}
                    onChange={(e) => setSettings({ ...settings, alert_timeframe: e.target.value })}
                    placeholder="15m"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alert_risk_per_trade">Alert Risk per Trade (USD)</Label>
                  <Input
                    id="alert_risk_per_trade"
                    type="number"
                    min="1"
                    step="0.1"
                    value={settings.alert_risk_per_trade}
                    onChange={(e) => setSettings({ ...settings, alert_risk_per_trade: parseFloat(e.target.value) || 30.0 })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alert_check_interval">Alert Check Interval (seconds)</Label>
                  <Input
                    id="alert_check_interval"
                    type="number"
                    min="1"
                    value={settings.alert_check_interval}
                    onChange={(e) => setSettings({ ...settings, alert_check_interval: parseInt(e.target.value) || 5 })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alert_agent_endpoint">Alert Agent Endpoint</Label>
                  <Input
                    id="alert_agent_endpoint"
                    type="text"
                    value={settings.alert_agent_endpoint}
                    onChange={(e) => setSettings({ ...settings, alert_agent_endpoint: e.target.value })}
                    placeholder="http://localhost:5000/api/alert/signal"
                    className="w-full"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 6: STRATEGY SETTINGS */}
        {/* ============================================ */}
        <div className="pt-4 border-t-2 border-slate-300 space-y-4">
          <div className="pb-2 border-b-2 border-slate-300">
            <h3 className="text-lg font-bold text-slate-800">6. Strategy Settings</h3>
            <p className="text-xs text-slate-500 mt-1">Configure scalping and auto-strategy behavior</p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scalping_tp_percent">Scalping Take Profit (%)</Label>
              <Input
                id="scalping_tp_percent"
                type="number"
                min="0.1"
                step="0.1"
                value={settings.scalping_tp_percent}
                onChange={(e) => setSettings({ ...settings, scalping_tp_percent: parseFloat(e.target.value) || 5.0 })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scalping_sl_percent">Scalping Stop Loss (%)</Label>
              <Input
                id="scalping_sl_percent"
                type="number"
                min="0.1"
                step="0.1"
                value={settings.scalping_sl_percent}
                onChange={(e) => setSettings({ ...settings, scalping_sl_percent: parseFloat(e.target.value) || 5.0 })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto_strategy_cache_minutes">Auto Strategy Cache (minutes)</Label>
              <Input
                id="auto_strategy_cache_minutes"
                type="number"
                min="0"
                value={settings.auto_strategy_cache_minutes}
                onChange={(e) => setSettings({ ...settings, auto_strategy_cache_minutes: parseInt(e.target.value) || 0 })}
                className="w-full"
              />
              <p className="text-xs text-slate-500">Cache auto strategy selection (0 = re-evaluate every cycle)</p>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 7: LLM CONFIGURATION */}
        {/* ============================================ */}
        <div className="pt-4 border-t-2 border-slate-300 space-y-4">
          <div className="pb-2 border-b-2 border-slate-300">
            <h3 className="text-lg font-bold text-slate-800">7. LLM Configuration</h3>
            <p className="text-xs text-slate-500 mt-1">Configure AI model settings</p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="llm_model">LLM Model</Label>
              <select
                id="llm_model"
                value={settings.llm_model}
                onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c0e156]"
              >
                <option value="deepseek-reasoner">DeepSeek Reasoner (Best performance)</option>
                <option value="deepseek-chat">DeepSeek Chat (Faster, supports function calling)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deepseek_max_tokens">DeepSeek Max Tokens</Label>
              <Input
                id="deepseek_max_tokens"
                type="number"
                min="1000"
                step="1000"
                value={settings.deepseek_max_tokens}
                onChange={(e) => setSettings({ ...settings, deepseek_max_tokens: parseInt(e.target.value) || 20000 })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-sm",
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            )}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {message.text}
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

