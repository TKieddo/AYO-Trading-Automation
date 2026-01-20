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

interface DecisionsFeedProps {
  /**
   * Variant: "homepage" (transparent lime background) or "dashboard" (white background with dark text)
   * @default "homepage"
   */
  variant?: "homepage" | "dashboard";
}

export function DecisionsFeed({ variant = "homepage" }: DecisionsFeedProps = {}) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  
  // Styling based on variant
  const isDashboard = variant === "dashboard";
  const cardClassName = isDashboard 
    ? "rounded-[24px] bg-white border border-slate-200"
    : "rounded-[24px] bg-lime-400/20 backdrop-blur-md border-lime-400/30";
  const titleClassName = isDashboard
    ? "flex items-center gap-2 text-slate-800"
    : "flex items-center gap-2 text-white";
  const textClassName = isDashboard
    ? "text-slate-700"
    : "text-lime-200/80";
  const assetClassName = isDashboard
    ? "font-semibold text-slate-900"
    : "font-semibold text-white";
  const timeClassName = isDashboard
    ? "text-xs text-slate-500"
    : "text-xs text-lime-300/70";
  const dividerClassName = isDashboard
    ? "mt-3 border-b border-slate-200"
    : "mt-3 border-b border-lime-400/20";
  const timelineClassName = isDashboard
    ? "absolute left-3 inset-y-0 w-[2px] bg-slate-300"
    : "absolute left-3 inset-y-0 w-[2px] bg-lime-400/40";
  const nodeClassName = isDashboard
    ? "absolute left-[10px] top-4 h-3 w-3 rounded-full bg-slate-400 border-2 border-slate-200"
    : "absolute left-[10px] top-4 h-3 w-3 rounded-full bg-lime-400 border-2 border-black/20";
  const emptyIconClassName = isDashboard
    ? "w-12 h-12 text-slate-400 mb-4"
    : "w-12 h-12 text-lime-400/50 mb-4";
  const emptyTextClassName = isDashboard
    ? "text-slate-600 text-sm mb-2"
    : "text-lime-200/80 text-sm mb-2";
  const emptySubtextClassName = isDashboard
    ? "text-slate-500 text-xs"
    : "text-lime-300/60 text-xs";
  const loadingClassName = isDashboard
    ? "h-20 bg-slate-100 rounded"
    : "h-20 bg-lime-400/10 rounded";

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
      <Card className={cardClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Brain className="w-5 h-5" />
            AI Decisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={loadingClassName}></div>
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
      <Card className={cardClassName}>
        <CardHeader>
          <CardTitle className={titleClassName}>
            <Brain className="w-5 h-5" />
            AI Decisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className={emptyIconClassName} />
            <p className={emptyTextClassName}>No trading decisions yet</p>
            <p className={emptySubtextClassName}>
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
    <Card className={cardClassName}>
      <CardHeader>
        <CardTitle className={titleClassName}>
          <Brain className="w-5 h-5" />
          AI Decisions
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-0">
        <div className="relative max-h-[550px] overflow-y-auto pr-2">
          {/* Vertical timeline line */}
          <div className={timelineClassName}></div>
          <div className="space-y-0">
          {decisions.map((decision, idx) => {
            const isBuy = decision.action === "buy";
            const isSell = decision.action === "sell";
            const isHold = decision.action === "hold";

            return (
              <div key={decision.id} className="relative pl-8 py-3">
                {/* Node connector */}
                <div className={nodeClassName}></div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={assetClassName}>
                        {decision.asset}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          isBuy
                            ? isDashboard
                              ? "bg-green-500/40 text-green-900 border border-green-500/60"
                              : "bg-green-500/30 text-green-200 border border-green-400/50"
                            : isSell
                            ? isDashboard
                              ? "bg-red-500/40 text-red-900 border border-red-500/60"
                              : "bg-red-500/30 text-red-200 border border-red-400/50"
                            : isDashboard
                            ? "bg-slate-500/40 text-slate-900 border border-slate-500/60"
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
                      <div className={`text-sm mb-1 ${isDashboard ? "text-slate-800" : "text-lime-200/90"}`}>
                        Allocation: {formatCurrency(decision.allocationUsd)}
                      </div>
                    )}
                    {(decision.tpPrice || decision.slPrice) && (
                      <div className={`flex gap-4 text-xs mb-1 ${isDashboard ? "text-slate-700" : "text-lime-300/80"}`}>
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
                    <p className={`text-sm mt-2 leading-relaxed ${textClassName}`}>
                      {formatRationale(decision.rationale, decision.reasoning, decision.action)}
                    </p>
                  </div>
                  <div className={`text-xs flex-shrink-0 ${timeClassName}`}>
                    {formatRelativeTime(decision.timestamp)}
                  </div>
                </div>
                {/* Thin separator */}
                {idx < decisions.length - 1 && (
                  <div className={dividerClassName} />
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

