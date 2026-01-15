"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Loader2, TrendingUp, Target } from "lucide-react";

interface OptimizationProgressProps {
  optimizationId: string;
  onClose: () => void;
  onComplete: () => void;
}

interface OptimizationStatus {
  status: string;
  iterations_completed: number;
  max_iterations: number;
  best_profitability: number;
  target_profitability: number;
  current_parameters?: any;
  llm_reasoning?: string;
}

export function OptimizationProgress({
  optimizationId,
  onClose,
  onComplete,
}: OptimizationProgressProps) {
  const [status, setStatus] = useState<OptimizationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
    }, 2000); // Poll every 2 seconds

    fetchStatus();

    return () => clearInterval(interval);
  }, [optimizationId]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/trading/optimize/${optimizationId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data.optimization);
        setLoading(false);

        if (data.optimization.status === "completed" || data.optimization.status === "stopped") {
          onComplete();
        }
      }
    } catch (error) {
      console.error("Failed to fetch optimization status:", error);
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`/api/trading/optimize/${optimizationId}/stop`, { method: "POST" });
    } catch (error) {
      console.error("Failed to stop optimization:", error);
    }
  };

  if (loading || !status) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-white shadow-2xl">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = (status.iterations_completed / status.max_iterations) * 100;
  const improvement = status.best_profitability - (status.target_profitability - 50); // Estimate original
  const targetMet = status.best_profitability >= status.target_profitability;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-white shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Optimizing Strategy...
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">
                Iteration {status.iterations_completed} / {status.max_iterations}
              </span>
              <span className="text-slate-600">{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-[#d9f08f] via-[#c0e156] to-[#9cc32a] h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Best Result */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Best Profitability</p>
              <p className="text-2xl font-bold text-emerald-600">
                {status.best_profitability.toFixed(2)}%
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Target</p>
              <p className="text-2xl font-bold text-slate-900">
                {status.target_profitability}%
              </p>
            </div>
          </div>

          {/* Status */}
          {targetMet ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-700">
                <Target className="w-5 h-5" />
                <p className="font-medium">Target reached! Optimization complete.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <TrendingUp className="w-5 h-5" />
                <p className="font-medium">Optimizing... Finding better parameters</p>
              </div>
            </div>
          )}

          {/* Current Parameters */}
          {status.current_parameters && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-2">Current Test Parameters:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(status.current_parameters).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-slate-600">{key.replace(/_/g, " ")}:</span>
                    <span className="font-medium text-slate-900">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LLM Reasoning */}
          {status.llm_reasoning && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm font-medium text-purple-700 mb-1">AI Reasoning:</p>
              <p className="text-sm text-purple-600">{status.llm_reasoning}</p>
            </div>
          )}

          {/* Actions */}
          {status.status === "running" && (
            <Button
              variant="outline"
              onClick={handleStop}
              className="w-full"
            >
              Stop Optimization
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

