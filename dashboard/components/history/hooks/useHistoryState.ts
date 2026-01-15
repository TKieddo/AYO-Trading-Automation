"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HistoryOrder, HistoryTrade } from "../types";

export type RangeKey = "7d" | "30d" | "90d" | "1y" | "all";
export type SideFilter = "all" | "buy" | "sell";
export type TypeFilter = "all" | "market" | "limit";
export type StatusFilter = "all" | "open" | "filled" | "canceled" | "rejected" | "triggered";

export function useHistoryState() {
  const [range, setRange] = useState<RangeKey>("90d");
  const [filterSide, setFilterSide] = useState<SideFilter>("all");
  const [filterSymbol, setFilterSymbol] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterType, setFilterType] = useState<TypeFilter>("all");
  const [filtersStuck, setFiltersStuck] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  
  // State for trades fetched from API
  const [trades, setTrades] = useState<HistoryTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradesError, setTradesError] = useState<string | null>(null);

  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      setFiltersStuck(!entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch trades from API
  useEffect(() => {
    async function fetchTrades() {
      setTradesLoading(true);
      setTradesError(null);
      try {
        const response = await fetch("/api/trades/history", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch trades: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.trades && Array.isArray(data.trades)) {
          setTrades(data.trades);
        } else {
          setTrades([]);
        }
      } catch (error: any) {
        console.error("Error fetching trades:", error);
        setTradesError(error.message || "Failed to fetch trades");
        setTrades([]); // Set empty array on error
      } finally {
        setTradesLoading(false);
      }
    }
    fetchTrades();
    
    // Refresh trades every 5 minutes to get new data
    const interval = setInterval(() => {
      fetchTrades();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // State for orders fetched from API
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Fetch orders from API (ALL orders including filled, canceled, and open)
  useEffect(() => {
    async function fetchOrders() {
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        // Fetch ALL orders (history) - includes open, filled, canceled
        const response = await fetch("/api/orders/history", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch orders: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.orders && Array.isArray(data.orders)) {
          // Map API response to HistoryOrder format
          const mappedOrders: HistoryOrder[] = data.orders.map((o: any) => ({
            id: o.id || String(o.orderId || ""),
            symbol: o.symbol,
            side: o.side,
            type: o.type || "market",
            size: Number(o.size || 0),
            price: o.price != null ? Number(o.price) : undefined,
            status: (o.status === "open" ? "open" : (o.status === "canceled" ? "canceled" : (o.status === "rejected" ? "rejected" : (o.status === "triggered" ? "triggered" : "filled")))) as HistoryOrder["status"],
            createdAt: o.createdAt || o.created_at || new Date().toISOString(),
          }));
          setOrders(mappedOrders);
        } else {
          setOrders([]);
        }
      } catch (error: any) {
        console.error("Error fetching orders:", error);
        setOrdersError(error.message || "Failed to fetch orders");
        setOrders([]); // Set empty array on error
      } finally {
        setOrdersLoading(false);
      }
    }
    fetchOrders();
    
    // Refresh orders every 5 minutes (similar to trades)
    const interval = setInterval(() => {
      fetchOrders();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const symbols = useMemo(() => Array.from(new Set(trades.map(t => t.symbol))), [trades]);

  const rangeMs = useMemo(() => {
    const day = 24 * 3600 * 1000;
    if (range === "7d") return 7 * day;
    if (range === "30d") return 30 * day;
    if (range === "90d") return 90 * day;
    if (range === "1y") return 365 * day;
    return Infinity;
  }, [range]);

  const filteredTrades = useMemo(() => {
    const now = Date.now(); // Use current time instead of hardcoded date
    return trades.filter(t => {
      const ts = new Date(t.timestamp).getTime();
      if (!(now - ts <= rangeMs)) return false;
      if (filterSide !== "all" && t.side !== filterSide) return false;
      if (filterSymbol !== "all" && t.symbol !== filterSymbol) return false;
      return true;
    });
  }, [trades, rangeMs, filterSide, filterSymbol]);

  const winsAndLosses = useMemo(() => {
    // Filter trades that have valid PnL (not null/undefined)
    // Only count trades with actual PnL values (>= 0 for wins, < 0 for losses)
    const tradesWithPnl = filteredTrades.filter(t => t.pnl != null && !isNaN(t.pnl));
    const wins = tradesWithPnl.filter(t => t.pnl! >= 0).sort((a, b) => {
      // Sort by timestamp descending (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    const losses = tradesWithPnl.filter(t => t.pnl! < 0).sort((a, b) => {
      // Sort by timestamp descending (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    const sum = (arr: HistoryTrade[], key: keyof HistoryTrade) => arr.reduce((s, t) => {
      const val = t[key] as number;
      return s + (val != null && !isNaN(val) ? val : 0);
    }, 0);
    
    const avg = (arr: HistoryTrade[], key: keyof HistoryTrade) => {
      if (arr.length === 0) return 0;
      const total = sum(arr, key);
      return total / arr.length;
    };
    
    const total = wins.length + losses.length;
    
    return {
      wins,
      losses,
      winCount: wins.length,
      lossCount: losses.length,
      winPct: total > 0 ? Math.round((wins.length / total) * 100) : 0,
      lossPct: total > 0 ? Math.round((losses.length / total) * 100) : 0,
      winsTotalPnl: sum(wins, "pnl"),
      lossesTotalPnl: sum(losses, "pnl"),
      winsAvgPnl: avg(wins, "pnl"),
      lossesAvgPnl: avg(losses, "pnl"),
    };
  }, [filteredTrades]);

  const filteredOrders = useMemo(() => {
    const now = Date.now(); // Use current time instead of hardcoded date
    return orders.filter(o => {
      const ts = new Date(o.createdAt).getTime();
      if (!(now - ts <= rangeMs)) return false;
      if (filterSide !== "all" && o.side !== filterSide) return false;
      if (filterSymbol !== "all" && o.symbol !== filterSymbol) return false;
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterType !== "all" && o.type !== filterType) return false;
      return true;
    });
  }, [orders, rangeMs, filterSide, filterSymbol, filterStatus, filterType]);

  const aggregate = useMemo(() => {
    // Filter out trades without valid PnL for win rate calculation
    const tradesWithPnl = trades.filter(t => t.pnl != null && !isNaN(t.pnl));
    const totalTrades = tradesWithPnl.length;
    const winners = tradesWithPnl.filter(t => t.pnl! >= 0).length;
    const losers = totalTrades - winners;
    const winRate = totalTrades > 0 ? Math.round((winners / totalTrades) * 100) : 0;
    
    // Calculate net PnL from all trades (including those without explicit PnL if any)
    const netPnl = trades.reduce((s, t) => {
      const pnl = t.pnl != null && !isNaN(t.pnl) ? t.pnl : 0;
      return s + pnl;
    }, 0);
    
    // Calculate total fees from all trades
    const fees = trades.reduce((s, t) => {
      const fee = t.fee != null && !isNaN(t.fee) ? t.fee : 0;
      return s + fee;
    }, 0);
    
    return { totalTrades, winners, losers, winRate, netPnl, fees };
  }, [trades]);

  // Calculate order metrics (counts by status)
  const orderMetrics = useMemo(() => {
    const total = orders.length;
    const open = orders.filter(o => o.status === "open").length;
    const filled = orders.filter(o => o.status === "filled").length;
    const canceled = orders.filter(o => o.status === "canceled").length;
    const rejected = orders.filter(o => o.status === "rejected").length;

    return {
      total,
      open,
      filled,
      canceled,
      rejected,
      openPct: total > 0 ? Math.round((open / total) * 100) : 0,
      filledPct: total > 0 ? Math.round((filled / total) * 100) : 0,
      canceledPct: total > 0 ? Math.round((canceled / total) * 100) : 0,
      rejectedPct: total > 0 ? Math.round((rejected / total) * 100) : 0,
    };
  }, [orders]);

  // Calculate fees and profit metrics
  const feesAndProfit = useMemo(() => {
    const totalFees = trades.reduce((s, t) => s + (t.fee || 0), 0);
    const totalPnL = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const netProfit = totalPnL - totalFees; // Profit after accounting for fees
    const tradesWithFees = trades.filter(t => t.fee != null && !isNaN(t.fee) && t.fee > 0).length;
    const avgFeePerTrade = tradesWithFees > 0 ? totalFees / tradesWithFees : 0;
    const feeToPnLRatio = totalPnL !== 0 ? Math.abs((totalFees / totalPnL) * 100) : 0;
    const profitMargin = totalPnL !== 0 ? (netProfit / totalPnL) * 100 : 0;

    return {
      totalFees,
      totalPnL,
      netProfit,
      avgFeePerTrade,
      feeToPnLRatio,
      profitMargin,
    };
  }, [trades]);

  // Sync order metrics and fees to database (non-blocking)
  useEffect(() => {
    async function syncMetrics() {
      try {
        // Only sync if we have data
        if (orders.length > 0 || trades.length > 0) {
          await fetch("/api/metrics/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderMetrics,
              feesAndProfit,
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {
            // Silently fail - metrics sync is optional
          });
        }
      } catch (error) {
        // Ignore errors - this is background sync
      }
    }
    
    // Sync metrics every 5 minutes
    const syncInterval = setInterval(syncMetrics, 5 * 60 * 1000);
    
    // Also sync immediately after data loads
    if (orders.length > 0 && trades.length > 0) {
      syncMetrics();
    }
    
    return () => clearInterval(syncInterval);
  }, [orders.length, trades.length, orderMetrics, feesAndProfit]);

  const distribution = useMemo(() => {
    // Use filtered trades to respect date range and filters
    const total = filteredTrades.length;
    const buys = filteredTrades.filter(t => t.side === "buy");
    const sells = filteredTrades.filter(t => t.side === "sell");
    
    // Filter for trades with valid PnL (exclude null/undefined and ensure it's a number)
    // Note: We include 0 values since a trade could legitimately have 0 PnL
    const tradesWithPnl = filteredTrades.filter(t => {
      const pnl = t.pnl;
      return pnl != null && typeof pnl === 'number' && !isNaN(pnl) && isFinite(pnl);
    });
    const wins = tradesWithPnl.filter(t => t.pnl! > 0); // Only positive PnL counts as win
    const losses = tradesWithPnl.filter(t => t.pnl! < 0);
    
    const totalVolume = filteredTrades.reduce((s, t) => {
      const size = t.size != null && !isNaN(t.size) ? t.size : 0;
      const price = t.price != null && !isNaN(t.price) ? t.price : 0;
      return s + size * price;
    }, 0);
    
    const avgSize = total > 0 ? filteredTrades.reduce((s, t) => {
      const size = t.size != null && !isNaN(t.size) ? t.size : 0;
      return s + size;
    }, 0) / total : 0;
    
    const avgPnl = tradesWithPnl.length > 0 ? tradesWithPnl.reduce((s, t) => {
      const pnl = t.pnl != null && !isNaN(t.pnl) ? t.pnl : 0;
      return s + pnl;
    }, 0) / tradesWithPnl.length : 0;
    
    // Calculate median: extract all PnL values, sort, and find middle
    const pnls = tradesWithPnl.map(t => t.pnl!).filter(p => p != null && !isNaN(p) && isFinite(p)).sort((a, b) => a - b);
    const medianPnl = pnls.length > 0
      ? pnls.length % 2 === 1
        ? pnls[Math.floor(pnls.length / 2)] // Odd: middle value
        : (pnls[pnls.length / 2 - 1] + pnls[pnls.length / 2]) / 2 // Even: average of two middle values
      : 0;
    const best = pnls.length > 0 ? pnls[pnls.length - 1] : 0;
    const worst = pnls.length > 0 ? pnls[0] : 0;
    return {
      total,
      buys: buys.length,
      sells: sells.length,
      wins: wins.length,
      losses: losses.length,
      buyPct: total > 0 ? Math.round((buys.length / total) * 100) : 0,
      winPct: tradesWithPnl.length > 0 ? Math.round((wins.length / tradesWithPnl.length) * 100) : 0,
      totalVolume,
      avgSize,
      avgPnl,
      medianPnl,
      best: Number.isFinite(best) ? best : 0,
      worst: Number.isFinite(worst) ? worst : 0,
    };
  }, [filteredTrades]);

  const byPair = useMemo(() => {
    type PairAgg = {
      symbol: string;
      trades: number;
      wins: number;
      losses: number;
      winRate: number;
      volume: number;
      netPnl: number;
      avgPnl: number;
    };
    const map: Record<string, PairAgg> = {};
    for (const t of trades) {
      const rec: PairAgg =
        map[t.symbol] || { symbol: t.symbol, trades: 0, wins: 0, losses: 0, winRate: 0, volume: 0, netPnl: 0, avgPnl: 0 };
      rec.trades += 1;
      if (t.pnl >= 0) rec.wins += 1;
      else rec.losses += 1;
      rec.volume += t.size * t.price;
      rec.netPnl += t.pnl;
      map[t.symbol] = rec;
    }
    const arr = Object.values(map).map(r => ({
      ...r,
      winRate: r.trades ? Math.round((r.wins / r.trades) * 100) : 0,
      avgPnl: r.trades ? r.netPnl / r.trades : 0,
    }));
    const topWinners = [...arr].sort((a, b) => b.winRate - a.winRate).slice(0, 5);
    const mostTraded = [...arr].sort((a, b) => b.trades - a.trades).slice(0, 5);
    const topPnl = [...arr].sort((a, b) => b.netPnl - a.netPnl).slice(0, 5);
    return { all: arr, topWinners, mostTraded, topPnl };
  }, [trades]);

  return {
    // state
    range,
    filterSide,
    filterSymbol,
    filterStatus,
    filterType,
    filtersStuck,
    sideOpen,
    headerRef,
    setRange,
    setFilterSide,
    setFilterSymbol,
    setFilterStatus,
    setFilterType,
    setSideOpen,
    // data
    symbols,
    filteredTrades,
    filteredOrders,
    winsAndLosses,
    aggregate,
    distribution,
    byPair,
    // loading/error states
    tradesLoading,
    tradesError,
    ordersLoading,
    ordersError,
    // order metrics and fees
    orderMetrics,
    feesAndProfit,
  };
}


