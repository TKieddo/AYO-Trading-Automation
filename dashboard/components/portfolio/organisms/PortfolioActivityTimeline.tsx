"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Coins,
  DollarSign,
  Brain,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

type ActivityItem = {
  id: string;
  type: "transfer" | "swap" | "withdrawal" | "deposit" | "profit" | "loss" | "asset_change" | "decision" | "commission" | "funding_fee" | "realized_pnl";
  timestamp: string;
  title: string;
  subtitle?: string;
  amount?: number;
  amountFormatted?: string;
  icon: typeof Wallet;
  color: string;
  bgColor: string;
  borderColor: string;
  details?: string;
};

type UserProfile = {
  name: string;
  email: string;
  initials: string;
};

type PortfolioActivityTimelineProps = {
  user?: UserProfile;
};

function maskEmail(email: string): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email.replace(/[a-zA-Z0-9]/g, "*");
  const maskedLocal = local.slice(0, 2) + "*".repeat(Math.max(0, local.length - 2));
  return `${maskedLocal}@${domain}`;
}

function getInitials(name: string, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

function deriveUserInfo(): UserProfile {
  // Try to get from localStorage or use defaults
  const storedName = typeof window !== "undefined" ? localStorage.getItem("userName") : null;
  const storedEmail = typeof window !== "undefined" ? localStorage.getItem("userEmail") : null;

  const name = storedName || "User";
  const email = storedEmail || "user@example.com";

  return {
    name,
    email,
    initials: getInitials(name, email),
  };
}

/**
 * Map activity type to icon, color, and display info
 */
function getActivityDisplayInfo(type: string, amount: number): {
  icon: typeof Wallet;
  color: string;
  bgColor: string;
  borderColor: string;
  title: string;
} {
  const isPositive = amount >= 0;
  
  switch (type) {
    case "profit":
    case "realized_pnl":
      return {
        icon: TrendingUp,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        borderColor: "border-emerald-200",
        title: isPositive ? "Trading Profit Realized" : "Trading Loss Realized",
      };
    case "loss":
      return {
        icon: TrendingDown,
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        title: "Trading Loss Realized",
      };
    case "deposit":
      return {
        icon: ArrowUp,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        borderColor: "border-emerald-200",
        title: "Funds Deposited",
      };
    case "withdrawal":
      return {
        icon: ArrowDown,
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        title: "Funds Withdrawn",
      };
    case "transfer":
      return {
        icon: ArrowUpRight,
        color: "text-slate-600",
        bgColor: "bg-slate-50",
        borderColor: "border-slate-200",
        title: "Internal Transfer",
      };
    case "commission":
      return {
        icon: DollarSign,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
        title: "Trading Commission",
      };
    case "funding_fee":
      return {
        icon: Coins,
        color: isPositive ? "text-emerald-600" : "text-red-600",
        bgColor: isPositive ? "bg-emerald-50" : "bg-red-50",
        borderColor: isPositive ? "border-emerald-200" : "border-red-200",
        title: isPositive ? "Funding Fee Received" : "Funding Fee Paid",
      };
    default:
      return {
        icon: Wallet,
        color: "text-slate-600",
        bgColor: "bg-slate-50",
        borderColor: "border-slate-200",
        title: "Portfolio Activity",
      };
  }
}

export function PortfolioActivityTimeline({ user }: PortfolioActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [decisions, setDecisions] = useState<ActivityItem[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const itemsPerPage = 5;
  const userProfile = user || deriveUserInfo();
  const maskedEmail = maskEmail(userProfile.email);

  // Fetch real portfolio activities
  async function fetchActivities() {
    try {
      setLoading(true);
      
      // Fetch income history
      const incomeResponse = await fetch("/api/income/history?limit=100");
      let incomeActivities: ActivityItem[] = [];
      
      if (incomeResponse.ok) {
        const incomeData = await incomeResponse.json();
        if (incomeData.activities && Array.isArray(incomeData.activities)) {
          incomeActivities = incomeData.activities.map((activity: any) => {
            const amount = Number(activity.amount || 0);
            const displayInfo = getActivityDisplayInfo(activity.type, amount);
            const isPositive = amount >= 0;
            
            return {
              id: activity.id || `income-${activity.income_id}`,
              type: activity.type as ActivityItem["type"],
              timestamp: activity.timestamp,
              title: displayInfo.title,
              subtitle: activity.symbol ? `${activity.symbol}` : activity.description || "",
              amount,
              amountFormatted: isPositive 
                ? `+$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `-$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              icon: displayInfo.icon,
              color: displayInfo.color,
              bgColor: displayInfo.bgColor,
              borderColor: displayInfo.borderColor,
              details: activity.description,
            };
          });
        }
      }

      // Fetch trades with PnL and commissions
      const tradesResponse = await fetch("/api/trades/history?limit=100");
      let tradeActivities: ActivityItem[] = [];
      let commissionActivities: ActivityItem[] = [];
      
      if (tradesResponse.ok) {
        const tradesData = await tradesResponse.json();
        if (tradesData.trades && Array.isArray(tradesData.trades)) {
          // Process PnL activities
          const pnlTrades = tradesData.trades
            .filter((trade: any) => trade.pnl != null && trade.pnl !== 0)
            .map((trade: any) => {
              const pnl = Number(trade.pnl || 0);
              const isPositive = pnl >= 0;
              const type = isPositive ? "profit" : "loss";
              const displayInfo = getActivityDisplayInfo(type, pnl);
              
              return {
                id: `trade-pnl-${trade.id || trade.timestamp}`,
                type: type as ActivityItem["type"],
                timestamp: trade.timestamp,
                title: displayInfo.title,
                subtitle: `${trade.symbol} ${trade.side}`,
                amount: pnl,
                amountFormatted: isPositive
                  ? `+$${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `-$${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                icon: displayInfo.icon,
                color: displayInfo.color,
                bgColor: displayInfo.bgColor,
                borderColor: displayInfo.borderColor,
                details: `Realized P&L from ${trade.symbol} ${trade.side} position`,
              };
            });
          
          tradeActivities = pnlTrades;
          
          // Process commission activities from trades
          commissionActivities = tradesData.trades
            .filter((trade: any) => trade.fee != null && trade.fee !== 0 && Number(trade.fee) > 0)
            .map((trade: any) => {
              const fee = Number(trade.fee || 0);
              const displayInfo = getActivityDisplayInfo("commission", -fee); // Negative because it's a cost
              
              return {
                id: `trade-commission-${trade.id || trade.timestamp}`,
                type: "commission" as ActivityItem["type"],
                timestamp: trade.timestamp,
                title: displayInfo.title,
                subtitle: `${trade.symbol} ${trade.side}`,
                amount: -fee, // Negative because commission is a cost
                amountFormatted: `-$${Math.abs(fee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                icon: displayInfo.icon,
                color: displayInfo.color,
                bgColor: displayInfo.bgColor,
                borderColor: displayInfo.borderColor,
                details: `Trading commission for ${trade.symbol} ${trade.side} trade`,
              };
            });
        }
      }

      // Combine and sort by timestamp
      const allActivities = [...incomeActivities, ...tradeActivities, ...commissionActivities].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(allActivities);
      setLastSynced(new Date());
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch AI decisions
  async function fetchDecisions() {
    try {
      const response = await fetch("/api/decisions?limit=5");
      if (response.ok) {
        const decisionsData = await response.json();
        const decisionItems: ActivityItem[] = decisionsData.map((decision: any) => ({
          id: `decision-${decision.id}`,
          type: "decision",
          timestamp: decision.timestamp,
          title: `AI Decision: ${decision.action.toUpperCase()} ${decision.asset}`,
          subtitle: decision.rationale || decision.reasoning || "AI trading decision",
          amount: decision.allocationUsd || 0,
          amountFormatted: decision.allocationUsd ? `$${decision.allocationUsd.toFixed(2)}` : undefined,
          icon: Brain,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
          borderColor: "border-purple-200",
          details:
            decision.allocationUsd && decision.allocationUsd > 0
              ? `Allocation: $${decision.allocationUsd.toFixed(2)}`
              : undefined,
        }));
        setDecisions(decisionItems);
      }
    } catch (error) {
      console.error("Failed to fetch decisions:", error);
    }
  }

  // Manual refresh function
  async function handleRefresh() {
    await Promise.all([fetchActivities(), fetchDecisions()]);
  }

  // Initial load and auto-refresh
  useEffect(() => {
    // Trigger initial sync on mount
    async function initialSync() {
      try {
        // Check if we need to sync trades to portfolio_activities
        const syncStatus = await fetch("/api/sync/trades-to-activities").catch(() => null);
        if (syncStatus?.ok) {
          const status = await syncStatus.json();
          if (status.needsSync) {
            // Backfill trades to portfolio_activities
            await fetch("/api/sync/trades-to-activities", { method: "POST" }).catch(() => {
              // Silently fail
            });
          }
        }
        
        // Trigger income history sync (non-blocking)
        fetch("/api/income/history?forceSync=false&limit=1000").catch(() => {
          // Silently fail - sync is optional
        });
        
        // Trigger portfolio activities sync (non-blocking)
        fetch("/api/sync/portfolio-activities").catch(() => {
          // Silently fail - sync is optional
        });
      } catch (error) {
        // Ignore sync errors
      }
    }
    
    initialSync();
    fetchActivities();
    fetchDecisions();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchActivities();
      fetchDecisions();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const totalPages = Math.ceil(activities.length / itemsPerPage);
  const paginatedActivities = activities.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const nextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  };

  const prevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  function TimelineItem({ activity }: { activity: ActivityItem }) {
    const Icon = activity.icon;
    const time = new Date(activity.timestamp);
    const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = time.toLocaleDateString([], { month: "short", day: "numeric" });
    const isPositive = activity.amount && activity.amount > 0;
    const amountColor = activity.type === "profit" 
      ? "text-emerald-600" 
      : activity.type === "loss" 
        ? "text-red-600"
        : activity.type === "withdrawal"
          ? "text-red-600"
          : "text-slate-700";

    return (
      <div className="relative flex items-start group">
        {/* Timeline node */}
        <div className="z-10 shrink-0 mr-3 mt-1">
          <div
            className={`rounded-full ${activity.bgColor} flex items-center justify-center w-8 h-8 ring-2 ring-white border ${activity.borderColor}`}
          >
            <Icon className={`w-4 h-4 ${activity.color}`} />
          </div>
        </div>

        {/* Activity content */}
        <div className="flex-1 min-w-0 pb-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900 leading-tight mb-0.5">
                {activity.title}
              </div>
              {activity.subtitle && (
                <div className="text-[10px] text-slate-500 mb-1">{activity.subtitle}</div>
              )}
              {activity.details && (
                <div className="text-[10px] text-slate-600 mt-1">{activity.details}</div>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              {activity.amountFormatted && (
                <div className={`text-xs font-bold ${amountColor}`}>
                  {activity.amountFormatted}
                </div>
              )}
              <div className="text-[10px] text-slate-400 flex flex-col items-end">
                <span>{timeStr}</span>
                <span>{dateStr}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function TimelineSection({
    title,
    items,
    loading: isLoading,
    emptyMessage = "No activities",
    showPagination = false,
    paginationProps,
  }: {
    title: string;
    items: ActivityItem[];
    loading: boolean;
    emptyMessage?: string;
    showPagination?: boolean;
    paginationProps?: {
      currentPage: number;
      totalPages: number;
      onPrev: () => void;
      onNext: () => void;
      onGoToPage: (page: number) => void;
    };
  }) {
    return (
      <div className="mb-6">
        <h3 className="text-slate-800 font-semibold mb-4 text-sm">{title}</h3>
        <div className="relative pl-2">
          {/* Timeline vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-slate-300 z-0" />

          {isLoading ? (
            <div className="ml-12 text-slate-400 text-sm py-4">Loading...</div>
          ) : items.length === 0 ? (
            <div className="ml-12 text-slate-400 text-sm py-4">{emptyMessage}</div>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((activity) => (
                  <TimelineItem key={activity.id} activity={activity} />
                ))}
              </div>
              {showPagination && paginationProps && paginationProps.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={paginationProps.onPrev}
                    disabled={paginationProps.currentPage === 0}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: paginationProps.totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => paginationProps.onGoToPage(i)}
                        className={`w-2 h-2 rounded-full transition ${
                          paginationProps.currentPage === i
                            ? "bg-slate-900 w-6"
                            : "bg-slate-300 hover:bg-slate-400"
                        }`}
                        aria-label={`Go to page ${i + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={paginationProps.onNext}
                    disabled={paginationProps.currentPage >= paginationProps.totalPages - 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100 transition"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="p-6 sticky top-4 ring-1 ring-black/10 h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
      {/* User Profile Section */}
      <div className="mb-6 pb-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FEF9C3] to-[#ECFCCB] ring-2 ring-slate-200 flex items-center justify-center">
              <span className="text-slate-900 font-semibold text-sm">{userProfile.initials}</span>
            </div>
            <div>
              <div className="text-slate-900 font-semibold">{userProfile.name}</div>
              <div className="text-slate-500 text-xs">Portfolio Activity</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastSynced && (
              <div className="text-[10px] text-slate-400">
                {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="rounded-full bg-black text-white text-xs px-3 py-1.5 font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {maskedEmail}
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Timeline Sections */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        {/* Portfolio Activities with Pagination */}
        <TimelineSection
          title="Portfolio Activities"
          items={paginatedActivities}
          loading={loading}
          emptyMessage="No portfolio activities"
          showPagination={true}
          paginationProps={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            onGoToPage: goToPage,
          }}
        />

        {/* AI Decisions Section */}
        <TimelineSection
          title="AI Decisions"
          items={decisions}
          loading={loading}
          emptyMessage="No AI decisions yet"
        />
      </div>
    </Card>
  );
}

