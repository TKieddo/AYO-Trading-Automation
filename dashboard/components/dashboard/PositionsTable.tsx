"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/utils";
import type { Position } from "@/lib/types";

export function PositionsTable() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await fetch("/api/positions", {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPositions(data);
        }
      } catch (error) {
        console.error("Failed to fetch positions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 2000); // Update every 2s for real-time prices

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="bg-black text-white rounded-[20px]">
        <CardHeader className="py-3">
          <CardTitle className="text-[14px] text-white/80">Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded bg-white/10"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <Card className="bg-black text-white rounded-[20px]">
        <CardHeader className="py-3">
          <CardTitle className="text-[14px] text-white/80">Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-white/60">No open positions</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black text-white rounded-[20px]">
      <CardHeader className="py-3">
        <CardTitle className="text-[14px] text-white/80">Open Positions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl ring-1 ring-white/10 overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 font-medium text-white/70">
                  Symbol
                </th>
                  <th className="text-left py-3 px-4 font-medium text-white/70">
                  Side
                </th>
                  <th className="text-right py-3 px-4 font-medium text-white/70">
                  Size / Leverage
                </th>
                  <th className="text-right py-3 px-4 font-medium text-white/70">
                  Entry
                </th>
                  <th className="text-right py-3 px-4 font-medium text-white/70">
                  Current
                </th>
                  <th className="text-right py-3 px-4 font-medium text-white/70">
                  P&L
                </th>
                  <th className="text-right py-3 px-4 font-medium text-white/70">
                  Opened
                </th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => {
                const isLong = position.side === "long";
                const isProfit = position.unrealizedPnl >= 0;
                
                // Get raw size (position amount)
                const rawSize = Math.abs(Number(position.size) || 0);
                
                // Calculate notional value (size in USDT) = leverage * margin OR use notional from API
                let notionalValue: number | null = position.notional != null ? Number(position.notional) : null;
                
                // Fallback: calculate notional from leverage * margin if not provided
                if (notionalValue == null && position.leverage && position.initialMargin) {
                  const leverage = Number(position.leverage);
                  const margin = Number(position.initialMargin);
                  if (leverage > 0 && margin > 0) {
                    notionalValue = leverage * margin;
                  }
                }
                
                // Fallback: calculate notional from size * entryPrice if still not available
                if (notionalValue == null && rawSize > 0 && position.entryPrice) {
                  notionalValue = rawSize * position.entryPrice;
                }
                
                // Use ROI directly from Binance API (roiPercent field) with fallback calculation
                let roiPercent: number | null = null;
                if (position.roiPercent != null && position.roiPercent !== undefined && !isNaN(Number(position.roiPercent))) {
                  roiPercent = Number(position.roiPercent);
                } else if (position.roi != null && position.roi !== undefined && !isNaN(Number(position.roi))) {
                  roiPercent = Number(position.roi);
                }
                
                // Fallback: calculate ROI if not provided
                if (roiPercent == null && position.initialMargin && position.initialMargin > 0 && position.unrealizedPnl != null) {
                  roiPercent = (position.unrealizedPnl / position.initialMargin) * 100;
                }
                
                // Use leverage directly from Binance API
                let leverage: number | null = null;
                if (position.leverage != null && position.leverage !== undefined && !isNaN(Number(position.leverage))) {
                  leverage = Number(position.leverage);
                }
                
                // Use openTime from Binance API (timestamp in ms) or openedAt (ISO string)
                let openedAtTime: string | number | undefined = position.openedAt;
                if (position.openTime) {
                  // Convert timestamp in ms to ISO string for formatRelativeTime
                  openedAtTime = new Date(position.openTime).toISOString();
                }

                return (
                  <tr
                    key={position.id}
                    className="border-b border-white/10 hover:bg-white/5"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {position.symbol}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          isLong
                            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                            : "bg-red-500/15 text-red-300 ring-1 ring-red-500/30"
                        }`}
                      >
                        {isLong ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                        {position.side.toUpperCase()}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {/* Display notional value (size in USDT) = leverage * margin */}
                      <div className="text-white">
                        {notionalValue != null && notionalValue > 0 
                          ? formatCurrency(notionalValue) 
                          : "-"}
                      </div>
                      {leverage != null && !isNaN(leverage) && leverage > 0 ? (
                        <div className="text-xs text-white/50">
                          {Math.round(leverage * 100) / 100}x
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-right text-white/70">
                      {formatCurrency(position.entryPrice)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-white">
                        {formatCurrency(position.currentPrice)}
                      </div>
                      {roiPercent != null ? (
                        <div
                          className={`text-xs ${
                            isProfit
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {roiPercent >= 0 ? "+" : ""}
                          {roiPercent.toFixed(2)}%
                        </div>
                      ) : (
                        <div className="text-xs text-white/50">-</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div
                        className={`font-semibold ${
                          isProfit
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {formatCurrency(position.unrealizedPnl)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-white/50">
                      {openedAtTime ? formatRelativeTime(openedAtTime) : "N/A"}
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

