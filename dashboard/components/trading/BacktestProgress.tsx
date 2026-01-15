"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface BacktestProgressProps {
  isOpen: boolean;
  progress: {
    stage: string;
    message: string;
    percentage?: number;
  } | null;
  onClose: () => void;
}

export function BacktestProgress({ isOpen, progress, onClose }: BacktestProgressProps) {
  if (!isOpen) return null;

  const getStageIcon = () => {
    if (!progress) return <Loader2 className="w-8 h-8 animate-spin text-[#c0e156]" />;
    
    if (progress.stage === "error") {
      return <AlertCircle className="w-8 h-8 text-red-500" />;
    }
    if (progress.stage === "complete") {
      return <CheckCircle className="w-8 h-8 text-emerald-500" />;
    }
    return <Loader2 className="w-8 h-8 animate-spin text-[#c0e156]" />;
  };

  const getStageColor = () => {
    if (!progress) return "text-slate-600";
    if (progress.stage === "error") return "text-red-600";
    if (progress.stage === "complete") return "text-emerald-600";
    return "text-slate-600";
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <Card className="w-full max-w-md bg-white shadow-2xl">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            {getStageIcon()}
            
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">
                {progress?.stage === "error" 
                  ? "Backtest Failed" 
                  : progress?.stage === "complete"
                  ? "Backtest Complete!"
                  : "Running Backtest..."}
              </h3>
              
              <p className={`text-sm ${getStageColor()}`}>
                {progress?.message || "Initializing backtest..."}
              </p>
              
              {progress?.percentage !== undefined && progress.stage !== "complete" && progress.stage !== "error" && (
                <div className="w-full bg-slate-200 rounded-full h-2 mt-4">
                  <div
                    className="bg-gradient-to-r from-[#d9f08f] via-[#c0e156] to-[#9cc32a] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                  />
                </div>
              )}
              
              {progress?.percentage !== undefined && progress.stage !== "complete" && progress.stage !== "error" && (
                <p className="text-xs text-slate-500 mt-2">
                  {progress.percentage}% complete
                </p>
              )}
            </div>
            
            {progress?.stage === "complete" && (
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 rounded-md font-medium hover:brightness-95 transition-all"
              >
                Close
              </button>
            )}
            
            {progress?.stage === "error" && (
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-slate-200 text-slate-900 rounded-md font-medium hover:bg-slate-300 transition-all"
              >
                Close
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

