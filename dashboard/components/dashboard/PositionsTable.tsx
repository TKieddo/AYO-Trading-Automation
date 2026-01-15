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
        const response = await fetch("/api/positions");
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
    const interval = setInterval(fetchPositions, 5000); // Update every 5s

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
                  Size
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
                const pnlPercent =
                  ((position.currentPrice - position.entryPrice) /
                    position.entryPrice) *
                  100;

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
                      <div className="text-white">
                        {formatNumber(position.size, 6)}
                      </div>
                      {position.leverage && (
                        <div className="text-xs text-white/50">
                          {position.leverage}x
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-white/70">
                      {formatCurrency(position.entryPrice)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-white">
                        {formatCurrency(position.currentPrice)}
                      </div>
                      <div
                        className={`text-xs ${
                          isProfit
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {isLong ? "+" : "-"}
                        {Math.abs(pnlPercent).toFixed(2)}%
                      </div>
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
                      {formatRelativeTime(position.openedAt)}
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

