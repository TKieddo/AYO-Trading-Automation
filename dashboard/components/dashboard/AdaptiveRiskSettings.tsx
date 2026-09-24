"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, CheckCircle, AlertCircle } from "lucide-react";

type FieldType = "number" | "text" | "bool" | "select";

interface Field {
  key: string;
  label: string;
  type: FieldType;
  help: string;
  step?: string;
  options?: { value: string; label: string }[];
  nullable?: boolean;
}

interface Section {
  title: string;
  blurb: string;
  fields: Field[];
}

/**
 * Mirrors ADAPTIVE_RISK_FIELDS in app/api/trading/settings/route.ts. Every value the
 * agent reads at runtime is editable here so tuning never requires a redeploy.
 */
const SECTIONS: Section[] = [
  {
    title: "Exits (volatility-adaptive)",
    blurb:
      "Exit mode controls the STOP only. Take-profit mode is independent so you can lock scalping profits at a fixed ROI% or $ while ATR still gives the stop enough room.",
    fields: [
      {
        key: "exit_mode",
        label: "Stop / exit mode",
        type: "select",
        help: "ATR scales the stop to volatility. Fixed uses STOP_LOSS_PERCENT as margin ROI.",
        options: [
          { value: "atr", label: "ATR (volatility-adaptive stop)" },
          { value: "fixed", label: "Fixed stop % (legacy)" },
        ],
      },
      {
        key: "tp_mode",
        label: "Take-profit mode",
        type: "select",
        help: "roi_percent = close at TAKE_PROFIT_PERCENT margin ROI. usd = close at TAKE_PROFIT_USD. atr_rr = legacy R-multiple of the ATR stop.",
        options: [
          { value: "roi_percent", label: "Margin ROI % (recommended for scalping)" },
          { value: "usd", label: "Fixed USD profit" },
          { value: "atr_rr", label: "ATR R:R multiple (legacy)" },
        ],
      },
      {
        key: "take_profit_usd",
        label: "Take profit (USD)",
        type: "number",
        step: "0.5",
        nullable: true,
        help: "Used when take-profit mode is USD. Example: 5 closes at +$5 unrealized.",
      },
      { key: "sl_atr_mult", label: "Stop = N x ATR", type: "number", step: "0.1", help: "Higher means fewer premature stop-outs but a larger loss when wrong. 2.0-3.0 is typical." },
      { key: "tp_rr_ratio", label: "Target = N x stop (R:R)", type: "number", step: "0.1", help: "Only used when take-profit mode is ATR R:R." },
      { key: "atr_period", label: "ATR period", type: "number", step: "1", help: "Candles used to measure volatility on the trading timeframe." },
      { key: "min_stop_price_pct", label: "Minimum stop (% of price)", type: "number", step: "0.1", help: "Floor so a quiet pair still gets a stop outside the spread." },
      { key: "max_stop_price_pct", label: "Maximum stop (% of price)", type: "number", step: "0.1", help: "Ceiling so an extreme volatility spike cannot open an unbounded risk." },
    ],
  },
  {
    title: "Position sizing (risk-based)",
    blurb:
      "Notional is solved from the stop distance, so every trade risks the same amount whether the stop is 0.8% or 4% wide. Set the sizing mode to 'risk' on the main settings card to use this.",
    fields: [
      { key: "risk_per_trade_usd", label: "Risk per trade (USD)", type: "number", step: "0.5", nullable: true, help: "Fixed dollar loss if the stop is hit. Leave blank to use the percentage below." },
      { key: "risk_per_trade_pct", label: "Risk per trade (% of equity)", type: "number", step: "0.05", help: "Used when the USD figure is blank. 0.5% is a common starting point." },
      { key: "min_notional_per_position", label: "Minimum notional (USD)", type: "number", step: "10", help: "Floor so a tight stop cannot size an order below the exchange minimum." },
      { key: "max_notional_per_position", label: "Maximum notional (USD)", type: "number", step: "100", nullable: true, help: "Optional hard cap on exposure per position. Blank means no cap." },
    ],
  },
  {
    title: "Scale-out and stop management",
    blurb:
      "Taking part of the position off at one unit of risk is the main lever on win rate: a trade that reaches 1R and then reverses ends as a small win rather than a full loss.",
    fields: [
      { key: "enable_profit_ladder", label: "Enable scale-out ladder", type: "bool", help: "Close portions of the position at set R multiples." },
      { key: "profit_ladder", label: "Ladder (R:size%)", type: "text", help: 'Comma separated, e.g. "1.0:50,2.0:30" closes half at 1R and 30% at 2R. The remainder rides the trailing stop.' },
      { key: "breakeven_after_first_fill", label: "Breakeven after first fill", type: "bool", help: "Move the stop to entry as soon as a rung fills. The banked profit already covers the risk." },
      { key: "enable_breakeven_stop", label: "Enable breakeven stop", type: "bool", help: "Move the stop to entry once the trade reaches the trigger below." },
      { key: "breakeven_trigger_r", label: "Breakeven trigger (R)", type: "number", step: "0.1", help: "Profit in R at which the stop moves to entry." },
      { key: "trailing_stop_activation_r", label: "Trailing activation (R)", type: "number", step: "0.1", help: "Profit in R before the trailing stop starts following price." },
      { key: "trailing_stop_distance_r", label: "Trailing distance (R)", type: "number", step: "0.1", help: "How far behind price the trailing stop sits, in units of the original stop." },
    ],
  },
  {
    title: "Re-entry control (anti-chop)",
    blurb:
      "On net-mode exchanges an opposite-side order closes the open position, so a flip-flopping signal becomes a churn of small losses plus fees. These cooldowns stop that pattern.",
    fields: [
      { key: "reentry_cooldown_minutes", label: "Cooldown after a close (min)", type: "number", step: "5", help: "Minutes before the same asset can be traded again." },
      { key: "loss_reentry_cooldown_minutes", label: "Cooldown after a loss (min)", type: "number", step: "5", help: "Longer pause when the close was a loss." },
      { key: "block_direction_flip", label: "Block direction flips", type: "bool", help: "Forbid opening the opposite side of a pair during its cooldown." },
    ],
  },
  {
    title: "Circuit breakers",
    blurb:
      "These pause new entries only. Open positions stay under stop and target control so nothing is left unmanaged.",
    fields: [
      { key: "max_daily_loss_usd", label: "Daily loss limit (USD)", type: "number", step: "5", nullable: true, help: "Stop opening trades once realised losses reach this. Blank uses the percentage below." },
      { key: "max_daily_loss_pct", label: "Daily loss limit (% of equity)", type: "number", step: "0.5", help: "Used when the USD limit is blank." },
      { key: "max_consecutive_losses", label: "Max consecutive losses", type: "number", step: "1", help: "Pause after this many losing closes in a row. 0 disables the breaker." },
      { key: "loss_streak_pause_minutes", label: "Streak pause (min)", type: "number", step: "15", help: "How long entries stay paused after a losing streak." },
    ],
  },
  {
    title: "Higher-timeframe trend filter",
    blurb:
      "Requires the entry direction to agree with a slower timeframe. This removes most counter-trend entries at the cost of missing some early reversals. If the indicator data is unavailable the trade is allowed through.",
    fields: [
      { key: "enable_htf_trend_filter", label: "Enable trend filter", type: "bool", help: "Only take trades that agree with the confirmation timeframe." },
      { key: "htf_trend_timeframe", label: "Confirmation timeframe", type: "text", help: 'Slower timeframe used for direction, e.g. "1h" or "4h".' },
      { key: "htf_trend_fast_ema", label: "Fast EMA", type: "number", step: "1", help: "Must be shorter than the slow EMA." },
      { key: "htf_trend_slow_ema", label: "Slow EMA", type: "number", step: "1", help: "Direction is up when the fast EMA is above the slow EMA." },
      { key: "htf_trend_min_separation_pct", label: "Minimum EMA separation (%)", type: "number", step: "0.05", help: "Below this the higher timeframe is treated as a range rather than a trend." },
      { key: "htf_block_when_flat", label: "Skip entries when flat", type: "bool", help: "Stay out while the confirmation timeframe is ranging." },
    ],
  },
  {
    title: "Analysis timeframes",
    blurb: "Timeframes the agent uses when building market context for the model.",
    fields: [
      { key: "intraday_timeframe", label: "Intraday timeframe", type: "text", help: 'Fast timeframe for indicator series, e.g. "15m".' },
      { key: "longterm_timeframe", label: "Long-term timeframe", type: "text", help: 'Slow timeframe for context, e.g. "4h".' },
    ],
  },
  {
    title: "Pair hunter",
    blurb:
      "Controls which pairs are eligible. A narrower volatility band and a higher volume floor cut spread and slippage costs, which matter more than they look at high trade counts.",
    fields: [
      { key: "pair_hunter_timeframe", label: "Scoring timeframe", type: "text", help: 'Candles used to score candidates, e.g. "15m".' },
      { key: "pair_hunter_min_volatility", label: "Minimum ATR (%)", type: "number", step: "0.1", help: "Below this a pair is too quiet to pay for fees." },
      { key: "pair_hunter_ideal_volatility", label: "Ideal ATR (%)", type: "number", step: "0.1", help: "Scoring peaks here and fades toward the min and max." },
      { key: "pair_hunter_max_volatility", label: "Maximum ATR (%)", type: "number", step: "0.1", help: "Above this a pair is rejected as too erratic." },
      { key: "pair_hunter_min_volume_24h", label: "Minimum 24h volume (USD)", type: "number", step: "1000000", help: "Liquidity floor. Thin books cost more in spread than the edge is worth." },
      { key: "pair_hunter_min_trend_strength", label: "Minimum trend strength", type: "number", step: "1", help: "0-100. Rejects pairs that are chopping rather than trending." },
      { key: "pair_hunter_min_price", label: "Minimum price (USD)", type: "number", step: "0.001", help: "Avoids sub-penny tick-size noise." },
      { key: "pair_hunter_max_spread_pct", label: "Maximum spread (%)", type: "number", step: "0.05", help: "Reject pairs whose bid-ask spread eats the target." },
      { key: "pair_hunter_blacklist", label: "Blacklist", type: "text", help: "Space or comma separated assets that are never traded." },
      { key: "pair_hunter_weight_volatility", label: "Score weight: volatility", type: "number", step: "0.05", help: "Relative importance of sitting near the ideal ATR." },
      { key: "pair_hunter_weight_trend", label: "Score weight: trend", type: "number", step: "0.05", help: "Relative importance of directional strength." },
      { key: "pair_hunter_weight_setup", label: "Score weight: setup", type: "number", step: "0.05", help: "Relative importance of volume and range quality." },
    ],
  },
];

const ALL_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

export function AdaptiveRiskSettings() {
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/trading/settings");
        if (response.ok) {
          const data = await response.json();
          if (cancelled) return;
          const next: Record<string, any> = {};
          for (const key of ALL_KEYS) next[key] = data[key] ?? "";
          setValues(next);
        }
      } catch (error) {
        console.error("Failed to fetch adaptive risk settings:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, any> = {};
      for (const section of SECTIONS) {
        for (const field of section.fields) {
          const raw = values[field.key];
          if (field.type === "bool") {
            payload[field.key] = Boolean(raw);
          } else if (field.type === "number") {
            // An empty nullable field clears the override; an empty required field is skipped.
            if (raw === "" || raw === null) {
              if (field.nullable) payload[field.key] = null;
            } else {
              payload[field.key] = Number(raw);
            }
          } else if (raw !== "" && raw !== null && raw !== undefined) {
            payload[field.key] = raw;
          }
        }
      }

      const response = await fetch("/api/trading/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Saved. The agent picks these up on its next cycle." });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save settings" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to save settings" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 6000);
    }
  };

  const renderField = (field: Field) => {
    const value = values[field.key];

    if (field.type === "bool") {
      return (
        <div key={field.key} className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              id={field.key}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => setValues({ ...values, [field.key]: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300"
            />
            <Label htmlFor={field.key} className="font-semibold cursor-pointer">
              {field.label}
            </Label>
          </div>
          <p className="text-xs text-slate-500">{field.help}</p>
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key} className="font-semibold">
            {field.label}
          </Label>
          <select
            id={field.key}
            value={value ?? ""}
            onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c0e156]"
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">{field.help}</p>
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={field.key} className="font-semibold">
          {field.label}
        </Label>
        <Input
          id={field.key}
          type={field.type === "number" ? "number" : "text"}
          step={field.step}
          value={value ?? ""}
          placeholder={field.nullable ? "leave blank for none" : undefined}
          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
          className="w-full"
        />
        <p className="text-xs text-slate-500">{field.help}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adaptive Risk & Exits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-slate-200 rounded" />
            <div className="h-10 bg-slate-200 rounded" />
            <div className="h-10 bg-slate-200 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adaptive Risk & Exits</CardTitle>
        <p className="text-sm text-slate-500">
          Stop distance, target distance, and position size are one decision, not three. Widening
          the stop without widening the target just trades frequent small losses for occasional
          large ones. Saved values are read by the agent on its next cycle.
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title} className="space-y-4">
            <div className="pb-2 border-b-2 border-slate-300">
              <h3 className="text-lg font-bold text-slate-800">{section.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{section.blurb}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">{section.fields.map(renderField)}</div>
          </div>
        ))}

        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-md text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Risk Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
