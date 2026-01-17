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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchDecisions = async () => {
      try {
        // Fetch more decisions to ensure we show all recent activity
        const response = await fetch("/api/decisions?limit=50", {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });
        
        if (!isMounted) return; // Prevent state updates if component unmounted
        
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
          
          // Always update decisions if we got valid data (even if empty array)
          // But only clear if we've never successfully loaded before
          if (isMounted) {
            if (sorted.length > 0) {
              // Got new decisions - update
              setDecisions(sorted);
              if (!hasLoadedOnce) {
                setHasLoadedOnce(true);
              }
            } else if (!hasLoadedOnce) {
              // First load and got empty - set empty state
              setDecisions([]);
              setHasLoadedOnce(true);
            }
            // If we have existing decisions and new fetch returns empty, keep the old ones
            // This prevents flickering when API temporarily returns empty
          }
        }
        // Don't clear decisions on error - keep showing what we have
      } catch (error) {
        if (!isMounted) return;
        console.error("Failed to fetch decisions:", error);
        // Don't clear decisions on error - keep previous data visible
        // Only set hasLoadedOnce if this was the first attempt
        if (!hasLoadedOnce) {
          setHasLoadedOnce(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDecisions();
    // Refresh every 5 seconds to show new decisions
    const interval = setInterval(() => {
      if (isMounted) {
        fetchDecisions();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hasLoadedOnce]);

  // Show loading state only on initial load (when we have no decisions yet)
  if (loading && decisions.length === 0 && !hasLoadedOnce) {
    return (
      <Card className="rounded-[24px] bg-lime-400/20 backdrop-blur-md border-lime-400/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Brain className="w-5 h-5" />
            AI Decisions
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

  // Show empty state only if we've loaded at least once and have no decisions
  // This prevents flickering when API temporarily fails
  if (decisions.length === 0 && !loading && hasLoadedOnce) {
    return (
      <Card className="rounded-[24px] bg-lime-400/20 backdrop-blur-md border-lime-400/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Brain className="w-5 h-5" />
            AI Decisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="w-12 h-12 text-lime-400/50 mb-4" />
            <p className="text-lime-200/80 text-sm mb-2">No trading decisions yet</p>
            <p className="text-lime-300/60 text-xs">
              Decisions will appear here once the trading agent starts making trades
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Always show decisions if we have them, even if we're refreshing in background
  // This prevents flickering during updates
  return (
    <Card className="rounded-[24px] bg-lime-400/20 backdrop-blur-md border-lime-400/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Brain className="w-5 h-5" />
          AI Decisions
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-0">
        <div className="relative max-h-[550px] overflow-y-auto pr-2">
          {/* Vertical timeline line */}
          <div className="absolute left-3 inset-y-0 w-[2px] bg-lime-400/40"></div>
          <div className="space-y-0">
          {decisions.map((decision, idx) => {
            const isBuy = decision.action === "buy";
            const isSell = decision.action === "sell";
            const isHold = decision.action === "hold";

            return (
              <div key={decision.id} className="relative pl-8 py-3">
                {/* Node connector */}
                <div className="absolute left-[10px] top-4 h-3 w-3 rounded-full bg-lime-400 border-2 border-black/20"></div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">
                        {decision.asset}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          isBuy
                            ? "bg-green-500/30 text-green-200 border border-green-400/50"
                            : isSell
                            ? "bg-red-500/30 text-red-200 border border-red-400/50"
                            : "bg-slate-500/30 text-slate-200 border border-slate-400/50"
                        }`}
                      >
                        {isBuy && <ArrowUp className="w-3 h-3" />}
                        {isSell && <ArrowDown className="w-3 h-3" />}
                        {isHold && <Pause className="w-3 h-3" />}
                        {decision.action.toUpperCase()}
                      </span>
                    </div>
                    {decision.allocationUsd && (
                      <div className="text-sm text-lime-200/90 mb-1">
                        Allocation: {formatCurrency(decision.allocationUsd)}
                      </div>
                    )}
                    {(decision.tpPrice || decision.slPrice) && (
                      <div className="flex gap-4 text-xs text-lime-300/80 mb-1">
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
                    <p className="text-sm text-lime-200/80 mt-2 leading-relaxed">
                      {formatRationale(decision.rationale, decision.reasoning, decision.action)}
                    </p>
                  </div>
                  <div className="text-xs text-lime-300/70 flex-shrink-0">
                    {formatRelativeTime(decision.timestamp)}
                  </div>
                </div>
                {/* Thin separator */}
                {idx < decisions.length - 1 && (
                  <div className="mt-3 border-b border-lime-400/20" />
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

