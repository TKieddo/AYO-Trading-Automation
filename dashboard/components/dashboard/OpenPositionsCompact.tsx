"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  openedAt?: string;
}

export function OpenPositionsCompact() {
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await fetch("/api/positions", { cache: "no-store" });
        if (res.ok) setPositions(await res.json());
      } catch {}
    };
    fetchPositions();
    const id = setInterval(fetchPositions, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="mt-3 rounded-2xl bg-transparent border border-[#E0E0E0]">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold text-[#1A1A1A]">Open Positions</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        {positions.length === 0 ? (
          <div className="text-xs text-[#666]">No open positions</div>
        ) : (
          <div className="h-[176px] overflow-y-auto pr-1 space-y-2">
            <div className="grid grid-cols-4 gap-2 px-2.5 text-[10px] font-medium text-[#666] uppercase tracking-wider">
              <div>Symbol</div>
              <div>Side</div>
              <div className="text-right">Size</div>
              <div className="text-right">PnL</div>
            </div>
            {positions.map((p) => (
              <div key={p.id} className="grid grid-cols-4 gap-2 items-center rounded-md border border-[#E0E0E0] bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-md shadow-sm hover:from-white/50 hover:via-white/40 hover:to-white/30 transition-all px-2.5 py-2">
                <div className="truncate text-[12px] font-semibold text-[#1A1A1A]">{p.symbol}</div>
                <div>
                  <span className={`text-[11px] rounded-full px-1.5 py-0.5 ring-1 ${p.side === "long" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>{p.side}</span>
                </div>
                <div className="text-right text-[12px] text-[#1A1A1A]">{formatNumber(p.size, 6)}</div>
                <div className={`text-right text-[12px] font-semibold ${p.unrealizedPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(p.unrealizedPnl)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
