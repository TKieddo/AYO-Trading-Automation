"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptimizationDialogProps {
  backtestId: string;
  strategyId: string;
  currentProfitability: number;
  onClose: () => void;
  onOptimize: (config: OptimizationConfig) => void;
}

interface OptimizationConfig {
  target_profitability: number;
  max_iterations: number;
  optimization_method: "llm_guided" | "grid_search" | "random_search";
  parameters_to_optimize: string[];
}

export function OptimizationDialog({
  backtestId,
  strategyId,
  currentProfitability,
  onClose,
  onOptimize,
}: OptimizationDialogProps) {
  const [targetProfitability, setTargetProfitability] = useState(70);
  const [maxIterations, setMaxIterations] = useState(50);
  const [method, setMethod] = useState<"llm_guided" | "grid_search" | "random_search">("llm_guided");
  const [selectedParams, setSelectedParams] = useState<string[]>([
    "rsi_period",
    "ema_fast",
    "ema_slow",
    "take_profit",
    "stop_loss",
  ]);

  const toggleParam = (param: string) => {
    setSelectedParams((prev) =>
      prev.includes(param) ? prev.filter((p) => p !== param) : [...prev, param]
    );
  };

  const handleStart = () => {
    onOptimize({
      target_profitability: targetProfitability,
      max_iterations: maxIterations,
      optimization_method: method,
      parameters_to_optimize: selectedParams,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Optimize Strategy
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Performance */}
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">Current Profitability</p>
            <p className="text-2xl font-bold text-slate-900">{currentProfitability.toFixed(2)}%</p>
          </div>

          {/* Target Profitability */}
          <div className="space-y-2">
            <Label htmlFor="target-profitability">
              Target Profitability: {targetProfitability}%
            </Label>
            <input
              id="target-profitability"
              type="range"
              min="50"
              max="100"
              step="5"
              value={targetProfitability}
              onChange={(e) => setTargetProfitability(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>50%</span>
              <span>60%</span>
              <span>70%</span>
              <span>80%</span>
              <span>90%</span>
              <span>100%</span>
            </div>
            <p className="text-xs text-slate-500">
              AI will optimize until this target is reached or determines it's not achievable
            </p>
          </div>

          {/* Max Iterations */}
          <div className="space-y-2">
            <Label htmlFor="max-iterations">Max Optimization Iterations</Label>
            <Input
              id="max-iterations"
              type="number"
              min="10"
              max="200"
              value={maxIterations}
              onChange={(e) => setMaxIterations(Number(e.target.value))}
            />
            <p className="text-xs text-slate-500">
              Maximum number of parameter combinations to test (more = better results but slower)
            </p>
          </div>

          {/* Optimization Method */}
          <div className="space-y-2">
            <Label>Optimization Method</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="method"
                  value="llm_guided"
                  checked={method === "llm_guided"}
                  onChange={() => setMethod("llm_guided")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">LLM-Guided (Recommended)</p>
                  <p className="text-xs text-slate-500">
                    AI analyzes performance and suggests smart parameter changes
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="method"
                  value="grid_search"
                  checked={method === "grid_search"}
                  onChange={() => setMethod("grid_search")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Grid Search</p>
                  <p className="text-xs text-slate-500">
                    Tests all parameter combinations (slower but thorough)
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="method"
                  value="random_search"
                  checked={method === "random_search"}
                  onChange={() => setMethod("random_search")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Random Search</p>
                  <p className="text-xs text-slate-500">
                    Tests random parameter combinations (faster)
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Parameters to Optimize */}
          <div className="space-y-2">
            <Label>Parameters to Optimize</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "rsi_period", label: "RSI Period", range: "7-21" },
                { id: "ema_fast", label: "EMA Fast Period", range: "10-30" },
                { id: "ema_slow", label: "EMA Slow Period", range: "30-100" },
                { id: "take_profit", label: "Take Profit %", range: "3-10%" },
                { id: "stop_loss", label: "Stop Loss %", range: "1-5%" },
                { id: "macd_fast", label: "MACD Fast", range: "8-15" },
                { id: "macd_slow", label: "MACD Slow", range: "20-30" },
                { id: "macd_signal", label: "MACD Signal", range: "7-12" },
              ].map((param) => (
                <label
                  key={param.id}
                  className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedParams.includes(param.id)}
                    onChange={() => toggleParam(param.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{param.label}</p>
                    <p className="text-xs text-slate-500">{param.range}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleStart}
              disabled={selectedParams.length === 0}
              className="flex-1 bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Start Optimization
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

