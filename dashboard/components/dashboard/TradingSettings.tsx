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
          Configure leverage, take profit, stop loss, and position sizing. These settings are saved to the database and used by the trading agent.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Leverage */}
        <div className="space-y-2">
          <Label htmlFor="leverage" className="flex items-center gap-2">
            Default Leverage
            <span className="text-xs text-slate-500">(1-100x, will be capped by asset max)</span>
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

        {/* Take Profit */}
        <div className="space-y-2">
          <Label htmlFor="take_profit" className="flex items-center gap-2">
            Take Profit Percentage
            <span className="text-xs text-slate-500">(0.1-100%)</span>
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

        {/* Stop Loss */}
        <div className="space-y-2">
          <Label htmlFor="stop_loss" className="flex items-center gap-2">
            Stop Loss Percentage
            <span className="text-xs text-slate-500">(0.1-50%)</span>
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

        {/* Position Sizing Section */}
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Position Sizing</h3>
          
          {/* Position Sizing Mode */}
          <div className="space-y-2 mb-4">
            <Label htmlFor="position_sizing_mode" className="flex items-center gap-2">
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

          {/* Target Profit per 1% Move */}
          {(settings.position_sizing_mode === "auto" || settings.position_sizing_mode === "target_profit") && (
            <div className="space-y-2 mb-4">
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

          {/* Margin per Position */}
          {settings.position_sizing_mode === "margin" && (
            <div className="space-y-2 mb-4">
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

          {/* Max Positions */}
          <div className="space-y-2 mb-4">
            <Label htmlFor="max_positions" className="flex items-center gap-2">
              Maximum Concurrent Positions
              <span className="text-xs text-slate-500">(1-50)</span>
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

        {/* Active Strategies Selection */}
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Active Trading Strategies</h3>
          <p className="text-xs text-slate-500 mb-4">
            Select which backtested strategies should be used in live trading. Only strategies you manually select here will be active.
          </p>
          
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

