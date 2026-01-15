"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Filter, ChevronUp, ChevronDown, ArrowUp, ArrowDown, Info, Check } from "lucide-react";
import type { Position } from "@/lib/types";

type TabType = "LONG" | "SHORT";

interface TradingTableProps {
  activeTab: TabType;
  onPositionSelect?: (position: Position | null) => void;
  selectedPositionId?: string | null;
}

type SortField = "symbol" | "entryPrice" | "currentPrice" | "size" | "unrealizedPnl" | "leverage" | "openedAt";
type SortDirection = "asc" | "desc" | null;

export function TradingTable({ activeTab, onPositionSelect, selectedPositionId }: TradingTableProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("openedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/positions");
        if (response.ok) {
          const data = await response.json();
          setPositions(data || []);
        }
      } catch (error) {
        console.error("Failed to fetch positions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Filter positions by active tab
  const filteredByTab = useMemo(() => {
    return positions.filter((pos) => pos.side === activeTab.toLowerCase());
  }, [positions, activeTab]);

  // Filter by search query
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return filteredByTab;
    
    const query = searchQuery.toLowerCase();
    return filteredByTab.filter(
      (pos) =>
        pos.symbol.toLowerCase().includes(query) ||
        pos.symbol.split("/")[0].toLowerCase().includes(query)
    );
  }, [filteredByTab, searchQuery]);

  // Sort positions
  const sortedPositions = useMemo(() => {
    if (!sortField || !sortDirection) return filteredBySearch;

    return [...filteredBySearch].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case "symbol":
          aVal = a.symbol.toLowerCase();
          bVal = b.symbol.toLowerCase();
          break;
        case "entryPrice":
          aVal = a.entryPrice || 0;
          bVal = b.entryPrice || 0;
          break;
        case "currentPrice":
          aVal = a.currentPrice || 0;
          bVal = b.currentPrice || 0;
          break;
        case "size":
          aVal = Math.abs(a.size || 0);
          bVal = Math.abs(b.size || 0);
          break;
        case "unrealizedPnl":
          aVal = a.unrealizedPnl || 0;
          bVal = b.unrealizedPnl || 0;
          break;
        case "leverage":
          aVal = a.leverage || 0;
          bVal = b.leverage || 0;
          break;
        case "openedAt":
          aVal = new Date(a.openedAt || 0).getTime();
          bVal = new Date(b.openedAt || 0).getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredBySearch, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null -> asc
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField("openedAt");
        setSortDirection("desc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleRowClick = (position: Position) => {
    onPositionSelect?.(position);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 4) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const calculatePnLPercent = (position: Position) => {
    if (!position.entryPrice || position.entryPrice === 0) return 0;
    const pnl = position.unrealizedPnl || 0;
    const notional = Math.abs(position.size) * position.entryPrice;
    return notional > 0 ? (pnl / notional) * 100 : 0;
  };

  // Get asset logo/icon URL (using placeholder for now)
  const getAssetLogo = (symbol: string) => {
    const assetName = symbol.split("/")[0].toLowerCase();
    return `https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=40&h=40&q=80&auto=format&fit=crop`;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    const isActive = sortField === field;
    const direction = isActive ? sortDirection : null;

    return (
      <th
        className="py-2.5 px-3 text-left cursor-pointer hover:bg-white/10 transition-colors group border-r border-[#E0E0E0]"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-[#666] uppercase tracking-wide">
            {children}
          </span>
          {isActive && direction ? (
            direction === "asc" ? (
              <ChevronUp className="w-3 h-3 text-[#1A1A1A]" />
            ) : (
              <ChevronDown className="w-3 h-3 text-[#1A1A1A]" />
            )
          ) : (
            <div className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity">
              <ChevronUp className="w-3 h-3 text-[#999]" />
            </div>
          )}
        </div>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="bg-transparent rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white/10 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent rounded-2xl p-6">
      {/* Header with Search and Filter */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#1A1A1A] text-white text-sm font-semibold">
            Open {activeTab === "LONG" ? "Long" : "Short"} Positions
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#1A1A1A] text-white text-[10px] font-medium">
            {sortedPositions.length} {sortedPositions.length === 1 ? "position" : "positions"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Search Bar - Ultra Compact */}
          <div className="relative">
            <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 w-2.5 h-2.5 text-[#999]" />
            <input
              type="text"
              placeholder="Search crypto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-6 pr-2 py-1 w-32 text-[10px] border border-[#E0E0E0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8c4efd]/20 focus:border-[#8c4efd] transition-all bg-white/80 backdrop-blur-sm text-[#1A1A1A] placeholder:text-[#999]"
            />
          </div>

          {/* Filter Button - Ultra Compact */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md border transition-all ${
              showFilters
                ? "bg-[#8c4efd] text-white border-[#8c4efd]"
                : "bg-white/80 backdrop-blur-sm text-[#1A1A1A] border-[#E0E0E0] hover:bg-white/90"
            }`}
            title="Filter"
          >
            <Filter className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      {sortedPositions.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">
            {activeTab === "LONG" ? "📈" : "📉"}
          </div>
          <p className="text-base font-medium text-[#666] mb-1">
            No {activeTab === "LONG" ? "long" : "short"} positions found
          </p>
          <p className="text-sm text-[#999]">
            {searchQuery ? "Try adjusting your search" : "Open a position to see it here"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <div className="border border-[#E0E0E0] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/30">
                <tr className="border-b-2 border-[#E0E0E0]">
                  <th className="py-2.5 px-3 w-12 border-r border-[#E0E0E0] text-center"></th>
                  <SortableHeader field="symbol">
                    Name
                  </SortableHeader>
                  <th className="py-2.5 px-3 text-right border-r border-[#E0E0E0]">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] font-semibold text-[#666] uppercase tracking-wide">
                        Entry Price
                      </span>
                    </div>
                  </th>
                  <SortableHeader field="currentPrice">Current Price</SortableHeader>
                  <SortableHeader field="size">Size</SortableHeader>
                  <SortableHeader field="unrealizedPnl">PnL</SortableHeader>
                  <SortableHeader field="unrealizedPnl">24H %</SortableHeader>
                  <SortableHeader field="size">
                    <div className="flex items-center gap-1">
                      Notional
                      <Info className="w-2.5 h-2.5 text-[#999]" />
                    </div>
                  </SortableHeader>
                  <SortableHeader field="leverage">Leverage</SortableHeader>
                    </tr>
                  </thead>
                  <tbody>
              {sortedPositions.map((position, index) => {
                const isSelected = selectedPositionId === position.id;
                const pnl = position.unrealizedPnl || 0;
                const pnlPercent = calculatePnLPercent(position);
                const isPositive = pnl >= 0;
                const notionalValue = Math.abs(position.size) * (position.currentPrice || 0);
                const assetSymbol = position.symbol.split("/")[0];

                      return (
                        <tr
                    key={position.id}
                    onClick={() => handleRowClick(position)}
                    className={`
                      border-b border-[#E0E0E0] transition-all cursor-pointer
                      ${isSelected 
                        ? "bg-[#8c4efd]/10 border-l-4 border-l-[#8c4efd]" 
                        : "hover:bg-white/20"}
                    `}
                  >
                    {/* Radio Selection Box */}
                    <td 
                      className="py-2 px-3 border-r border-[#E0E0E0] text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(position);
                      }}
                    >
                      <div className="flex items-center justify-center">
                        <div
                          className={`
                            w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all
                            ${isSelected 
                              ? "bg-[#1A1A1A] border-[#1A1A1A]" 
                              : "bg-white border-[#D0D0D0] hover:border-[#1A1A1A]"}
                          `}
                        >
                          {isSelected && (
                            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Name */}
                    <td className="py-2 px-3 border-r border-[#E0E0E0]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8c4efd] to-[#fef9c3] flex items-center justify-center shrink-0 overflow-hidden">
                          <img
                            src={getAssetLogo(position.symbol)}
                            alt={assetSymbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=40&h=40&q=80&auto=format&fit=crop`;
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-[#1A1A1A] text-xs">
                            {assetSymbol}
                            </div>
                            <div className="text-[10px] text-[#999] mt-0.5">
                            {position.symbol}
                          </div>
                        </div>
                            </div>
                          </td>

                    {/* Entry Price */}
                    <td className="py-2 px-3 text-right border-r border-[#E0E0E0]">
                      <div className="font-medium text-[#1A1A1A] text-xs">
                        {formatCurrency(position.entryPrice || 0)}
                            </div>
                          </td>

                    {/* Current Price */}
                    <td className="py-2 px-3 text-right border-r border-[#E0E0E0]">
                      <div className="font-medium text-[#1A1A1A] text-xs">
                        {formatCurrency(position.currentPrice || 0)}
                            </div>
                          </td>

                    {/* Size */}
                    <td className="py-2 px-3 text-right border-r border-[#E0E0E0]">
                      <div className="font-medium text-[#1A1A1A] text-xs">
                        {formatNumber(Math.abs(position.size || 0), 4)}
              </div>
                      <div className="text-[10px] text-[#999] mt-0.5">
                        {formatNumber(Math.abs(position.size || 0), 2)} {assetSymbol}
            </div>
                    </td>

                    {/* PnL */}
                    <td className="py-2 px-3 text-right border-r border-[#E0E0E0]">
                      <div className={`font-semibold text-xs ${
                        isPositive ? "text-green-600" : "text-red-600"
                      }`}>
                        {formatCurrency(pnl)}
                            </div>
                          </td>

                    {/* 24H % (PnL %) */}
                    <td className="py-2 px-3 text-right border-r border-[#E0E0E0]">
                      <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        isPositive
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                      }`}>
                        {isPositive ? (
                          <ArrowUp className="w-2.5 h-2.5" />
                        ) : (
                          <ArrowDown className="w-2.5 h-2.5" />
                        )}
                        {formatPercent(pnlPercent)}
                            </div>
                          </td>

                    {/* Notional Value */}
                    <td className="py-2 px-3 text-right border-r border-[#E0E0E0]">
                      <div className="font-medium text-[#1A1A1A] text-xs">
                        {formatCurrency(notionalValue)}
                            </div>
                          </td>

                    {/* Leverage */}
                    <td className="py-2 px-3 text-right">
                      <div className="text-xs text-[#666]">
                        {position.leverage ? `${position.leverage}x` : "-"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
          </div>
        </div>
      )}
    </div>
  );
}
