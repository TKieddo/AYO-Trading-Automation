"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, TrendingUp, TrendingDown, Activity, Loader2, Sparkles } from "lucide-react";
import { OptimizationDialog } from "./OptimizationDialog";

interface BacktestResult {
  id: string;
  strategy_name: string;
  start_date: string;
  end_date: string;
  symbol: string;
  timeframe: string;
  total_return: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  created_at: string;
}

export function BacktestDashboard() {
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    avgReturn: 0,
    maxReturn: 0,
    avgSharpe: 0,
  });
  const [optimizationDialog, setOptimizationDialog] = useState<{
    open: boolean;
    backtestId: string;
    strategyId: string;
    profitability: number;
  } | null>(null);

  useEffect(() => {
    fetchBacktestResults();
  }, []);

  const fetchBacktestResults = async () => {
    try {
      const response = await fetch("/api/trading/backtests");
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        
        // Calculate stats
        if (data.results && data.results.length > 0) {
          const returns = data.results.map((r: BacktestResult) => r.total_return);
          const sharpes = data.results.map((r: BacktestResult) => r.sharpe_ratio || 0);
          setStats({
            total: data.results.length,
            avgReturn: returns.reduce((a: number, b: number) => a + b, 0) / returns.length,
            maxReturn: Math.max(...returns),
            avgSharpe: sharpes.reduce((a: number, b: number) => a + b, 0) / sharpes.length,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch backtest results:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Backtests</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg Return</p>
                <p className={`text-2xl font-bold ${stats.avgReturn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {stats.avgReturn.toFixed(2)}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Max Return</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {stats.maxReturn.toFixed(2)}%
                </p>
              </div>
              <Activity className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg Sharpe</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.avgSharpe.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backtest Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Backtest Results</CardTitle>
          <CardDescription>
            View and analyze backtest performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No backtest results yet.</p>
              <p className="text-sm mt-2">Run a backtest from the Strategy Library to see results here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Strategy</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Symbol</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Period</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Return</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Sharpe</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Drawdown</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Win Rate</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Trades</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">{result.strategy_name}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{result.symbol}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {new Date(result.start_date).toLocaleDateString()} - {new Date(result.end_date).toLocaleDateString()}
                      </td>
                      <td className={`py-3 px-4 text-sm text-right font-semibold ${result.total_return >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {result.total_return.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-slate-600">
                        {result.sharpe_ratio?.toFixed(2) || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-red-600">
                        {result.max_drawdown?.toFixed(2) || 'N/A'}%
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-slate-600">
                        {result.win_rate?.toFixed(1) || 'N/A'}%
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-slate-600">
                        {result.total_trades || 0}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500">
                        {new Date(result.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-2"
                          onClick={() => {
                            // TODO: Get strategy_id from result
                            setOptimizationDialog({
                              open: true,
                              backtestId: result.id,
                              strategyId: "", // Will need to fetch this
                              profitability: result.total_return,
                            });
                          }}
                        >
                          <Sparkles className="w-4 h-4" />
                          Optimize
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optimization Dialog */}
      {optimizationDialog?.open && (
        <OptimizationDialog
          backtestId={optimizationDialog.backtestId}
          strategyId={optimizationDialog.strategyId}
          currentProfitability={optimizationDialog.profitability}
          onClose={() => setOptimizationDialog(null)}
          onOptimize={async (config) => {
            // TODO: Start optimization
            console.log("Starting optimization:", config);
            // Close dialog and show progress
            setOptimizationDialog(null);
          }}
        />
      )}
    </div>
  );
}

