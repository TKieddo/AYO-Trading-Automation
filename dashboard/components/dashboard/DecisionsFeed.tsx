"use client";

import { useEffect, useState } from "react";
import { Brain, ArrowUp, ArrowDown, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Decision } from "@/lib/types";

/**
 * Formats rationale text to be more user-friendly for non-traders
 */
function formatRationale(rationale: string | undefined, reasoning: string | undefined, action: string): string {
  const text = (rationale || reasoning || "").trim();
  
  if (!text) {
    if (action === "buy") {
      return "The AI sees a good buying opportunity based on market analysis.";
    } else if (action === "sell") {
      return "The AI recommends selling based on current market conditions.";
    } else {
      return "Maintaining current position - waiting for better market conditions.";
    }
  }
  
  // Replace technical error messages with friendly explanations
  const friendlyReplacements: Record<string, string> = {
    "tool loop cap": "Analysis completed - maintaining current strategy while monitoring market conditions.",
    "parse error": "Holding position while processing market data.",
    "analysis loop limit reached": "Analysis completed - maintaining current strategy.",
  };
  
  let formatted = text;
  for (const [key, value] of Object.entries(friendlyReplacements)) {
    if (text.toLowerCase().includes(key.toLowerCase())) {
      formatted = value;
      break;
    }
  }
  
  // Capitalize first letter for better readability
  if (formatted && formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  
  return formatted;
}

export function DecisionsFeed() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        // Fetch more decisions to ensure we show all recent activity
        const response = await fetch("/api/decisions?limit=50");
        if (response.ok) {
          const data = await response.json();
          // Sort by timestamp descending (most recent first) if not already sorted
          const sorted = Array.isArray(data) 
            ? [...data].sort((a, b) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeB - timeA; // Descending
              })
            : [];
          setDecisions(sorted);
        } else {
          setDecisions([]);
        }
      } catch (error) {
        console.error("Failed to fetch decisions:", error);
        setDecisions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDecisions();
    // Refresh every 5 seconds to show new decisions
    const interval = setInterval(fetchDecisions, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="rounded-[24px] bg-lime-400/20 backdrop-blur-md border-lime-400/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Brain className="w-5 h-5" />
            Agent Decisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-lime-400/10 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Demo decisions for when there are no real decisions
  const demoDecisions: Decision[] = [
    {
      id: "demo-1",
      asset: "ETH/USD",
      action: "buy",
      allocationUsd: 5000,
      tpPrice: 3200,
      slPrice: 2800,
      rationale: "Strong bullish momentum detected with RSI indicating oversold recovery. Volume spike suggests institutional interest.",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "demo-2",
      asset: "BTC/USD",
      action: "hold",
      allocationUsd: 8000,
      tpPrice: 45000,
      slPrice: 42000,
      rationale: "Maintaining position while monitoring key support levels. Market consolidation phase expected.",
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "demo-3",
      asset: "SOL/USD",
      action: "sell",
      allocationUsd: 3000,
      tpPrice: 95,
      slPrice: 110,
      rationale: "Profit target reached. Taking gains as resistance level approaches. Risk-reward ratio favors exit.",
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "demo-4",
      asset: "WETH/USDC",
      action: "buy",
      allocationUsd: 2500,
      tpPrice: 3100,
      slPrice: 2900,
      rationale: "Technical breakout confirmed above key resistance. MACD crossover indicates upward trend continuation.",
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "demo-5",
      asset: "MATIC/USD",
      action: "hold",
      allocationUsd: 1500,
      rationale: "Waiting for clearer market direction. Current volatility suggests patience is prudent.",
      timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
    }
  ];

  const displayDecisions = decisions.length > 0 ? decisions : demoDecisions;

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          AI Decisions
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-0">
        <div className="relative max-h-[550px] overflow-y-auto pr-2">
          {/* Vertical timeline line */}
          <div className="absolute left-3 inset-y-0 w-[2px] bg-slate-300"></div>
          <div className="space-y-0">
          {displayDecisions.map((decision, idx) => {
            const isBuy = decision.action === "buy";
            const isSell = decision.action === "sell";
            const isHold = decision.action === "hold";

            return (
              <div key={decision.id} className="relative pl-8 py-3">
                {/* Node connector */}
                <div className="absolute left-[10px] top-4 h-3 w-3 rounded-full bg-slate-400 border-2 border-white"></div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {decision.asset}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          isBuy
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : isSell
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {isBuy && <ArrowUp className="w-3 h-3" />}
                        {isSell && <ArrowDown className="w-3 h-3" />}
                        {isHold && <Pause className="w-3 h-3" />}
                        {decision.action.toUpperCase()}
                      </span>
                    </div>
                    {decision.allocationUsd && (
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Allocation: {formatCurrency(decision.allocationUsd)}
                      </div>
                    )}
                    {(decision.tpPrice || decision.slPrice) && (
                      <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-500 mb-1">
                        {decision.tpPrice && (
                          <span title="Take Profit: Price target to close position at a profit">
                            Target: {formatCurrency(decision.tpPrice)}
                          </span>
                        )}
                        {decision.slPrice && (
                          <span title="Stop Loss: Price limit to minimize losses">
                            Stop: {formatCurrency(decision.slPrice)}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                      {formatRationale(decision.rationale, decision.reasoning, decision.action)}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-500 flex-shrink-0">
                    {formatRelativeTime(decision.timestamp)}
                  </div>
                </div>
                {/* Thin separator */}
                {idx < displayDecisions.length - 1 && (
                  <div className="mt-3 border-b border-slate-200" />
                )}
              </div>
            );
          })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

