"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, X, Loader2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { BacktestProgress } from "./BacktestProgress";

interface BacktestDialogProps {
  strategyId: string;
  strategyName: string;
  onClose: () => void;
  onBacktestComplete: () => void;
}

export function BacktestDialog({
  strategyId,
  strategyName,
  onClose,
  onBacktestComplete,
}: BacktestDialogProps) {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("5m");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // 3 months ago
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [initialCapital, setInitialCapital] = useState(300);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    stage: string;
    message: string;
    percentage?: number;
  } | null>(null);

  const handleRunBacktest = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress({ stage: "loading", message: "Initializing backtest...", percentage: 0 });

    try {
      setProgress({ stage: "loading", message: "Loading historical data from Binance...", percentage: 20 });
      
      const response = await fetch("/api/trading/backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy_id: strategyId,
          symbol,
          timeframe,
          start_date: startDate,
          end_date: endDate,
          initial_capital: initialCapital,
        }),
      });

      setProgress({ stage: "loading", message: "Running strategy simulation...", percentage: 60 });

      const data = await response.json();

      if (response.ok) {
        setProgress({ stage: "loading", message: "Calculating metrics...", percentage: 90 });
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setProgress({ stage: "complete", message: "Backtest completed successfully!", percentage: 100 });
        setResult(data.result);
        
        // Close progress modal and dialog after a short delay
        setTimeout(() => {
          setProgress(null);
          setRunning(false);
          onBacktestComplete();
        }, 1500);
      } else {
        setProgress({ stage: "error", message: data.error || "Failed to run backtest" });
        setError(data.error || "Failed to run backtest");
        setRunning(false);
      }
    } catch (err: any) {
      setProgress({ stage: "error", message: err.message || "An error occurred" });
      setError(err.message || "An error occurred");
      setRunning(false);
    }
  };

  return (
    <>
      <BacktestProgress
        isOpen={running}
        progress={progress}
        onClose={() => {
          setProgress(null);
          setRunning(false);
        }}
      />
      
      {!running && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Run Backtest: {strategyName}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {!result ? (
            <>
              {/* Symbol */}
              <div className="space-y-2">
                <Label htmlFor="symbol">Trading Pair</Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="BTCUSDT"
                  disabled={running}
                />
                <p className="text-xs text-slate-500">
                  Trading pair symbol (e.g., BTCUSDT, ETHUSDT)
                </p>
              </div>

              {/* Timeframe */}
              <div className="space-y-2">
                <Label htmlFor="timeframe">Timeframe</Label>
                <select
                  id="timeframe"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  disabled={running}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c0e156]"
                >
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                  <option value="15m">15 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="4h">4 Hours</option>
                  <option value="1d">1 Day</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={running}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={running}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>

              {/* Initial Capital */}
              <div className="space-y-2">
                <Label htmlFor="capital">Initial Capital (USD)</Label>
                <Input
                  id="capital"
                  type="number"
                  min="1"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  disabled={running}
                />
                <p className="text-xs text-slate-500">
                  Starting capital for the backtest simulation
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={onClose} className="flex-1" disabled={running}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRunBacktest}
                  disabled={running || !symbol || !startDate || !endDate}
                  className="flex-1 bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95"
                >
                  {running ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running Backtest...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Run Backtest
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            /* Results */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="font-medium text-emerald-700 mb-2">✅ Backtest Complete!</p>
                <p className="text-sm text-emerald-600">
                  Results have been saved. Check the Backtest Dashboard to view detailed metrics.
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Total Return</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    result.total_return >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {result.total_return?.toFixed(2) || "N/A"}%
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Sharpe Ratio</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {result.sharpe_ratio?.toFixed(2) || "N/A"}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-600">
                    {result.max_drawdown?.toFixed(2) || "N/A"}%
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Win Rate</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {result.win_rate?.toFixed(1) || "N/A"}%
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setError(null);
                  }}
                  className="flex-1"
                >
                  Run Another Backtest
                </Button>
                <Button
                  onClick={onClose}
                  className="flex-1 bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95"
                >
                  View in Dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
      )}
    </>
  );
}

