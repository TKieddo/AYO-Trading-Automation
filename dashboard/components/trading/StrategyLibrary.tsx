"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, PlayCircle, BarChart3, Loader2, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BacktestDialog } from "./BacktestDialog";

interface Strategy {
  id: string;
  name: string;
  description: string;
  status: "extracted" | "generated" | "backtested" | "active" | "inactive";
  created_at: string;
  source_video_url?: string;
}

export function StrategyLibrary() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [backtestDialog, setBacktestDialog] = useState<{
    open: boolean;
    strategyId: string;
    strategyName: string;
  } | null>(null);

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      const response = await fetch("/api/trading/strategies");
      if (response.ok) {
        const data = await response.json();
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error("Failed to fetch strategies:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      extracted: "bg-blue-100 text-blue-700",
      generated: "bg-purple-100 text-purple-700",
      backtested: "bg-emerald-100 text-emerald-700",
      active: "bg-green-100 text-green-700",
      inactive: "bg-slate-100 text-slate-700",
    };

    return (
      <span
        className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          styles[status as keyof typeof styles] || styles.inactive
        )}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Strategy Library
          </CardTitle>
          <CardDescription>
            Manage your trading strategies. Backtest them to find the best performers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {strategies.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No strategies yet.</p>
              <p className="text-sm mt-2">
                Extract a strategy from a video to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {strategies.map((strategy) => (
                <Card key={strategy.id} className="border border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900">{strategy.name}</h3>
                          {getStatusBadge(strategy.status)}
                        </div>
                        {strategy.description && (
                          <p className="text-sm text-slate-600 mb-3">{strategy.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>
                            Created: {new Date(strategy.created_at).toLocaleDateString()}
                          </span>
                          {strategy.source_video_url && (
                            <a
                              href={strategy.source_video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              View Source Video
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(strategy.status === "extracted" || strategy.status === "generated" || strategy.status === "backtested") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2"
                            onClick={() => {
                              setBacktestDialog({
                                open: true,
                                strategyId: strategy.id,
                                strategyName: strategy.name,
                              });
                            }}
                          >
                            <BarChart3 className="w-4 h-4" />
                            Backtest
                          </Button>
                        )}
                        {strategy.status === "backtested" && (
                          <p className="text-xs text-slate-500 italic">
                            Go to Settings to activate
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backtest Dialog */}
      {backtestDialog?.open && (
        <BacktestDialog
          strategyId={backtestDialog.strategyId}
          strategyName={backtestDialog.strategyName}
          onClose={() => setBacktestDialog(null)}
          onBacktestComplete={() => {
            setBacktestDialog(null);
            fetchStrategies(); // Refresh to show updated status
          }}
        />
      )}
    </div>
  );
}

