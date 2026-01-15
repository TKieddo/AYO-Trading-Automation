"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface Metrics {
  totalValue: number;
  balance: number;
  openPositions: number;
  totalPnL: number;
  dailyPnL: number;
}

export function OverviewStats() {
  const [m, setM] = useState<Metrics | null>(null);
  const [trendPct, setTrendPct] = useState<number | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [res, perfRes] = await Promise.all([
          fetch("/api/metrics", { cache: "no-store" }),
          fetch("/api/performance", { cache: "no-store" }),
        ]);

        if (res.ok) {
          setM(await res.json());
        }

        if (perfRes.ok) {
          const perf: Array<{ date: string; value: number }> = await perfRes.json();
          if (Array.isArray(perf) && perf.length >= 2) {
            const last = Number(perf[perf.length - 1]?.value ?? 0);
            const prev = Number(perf[perf.length - 2]?.value ?? 0);
            if (prev !== 0 && Number.isFinite(last) && Number.isFinite(prev)) {
              setTrendPct(((last - prev) / prev) * 100);
            } else {
              setTrendPct(null);
            }
          } else {
            setTrendPct(null);
          }
        }
      } catch {}
    };
    fetchAll();
    const id = setInterval(fetchAll, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card className="rounded-lg">
        <CardHeader className="py-1.5">
          <CardTitle className="text-slate-700 text-[13px]">Total Account Value</CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="flex items-baseline justify-between">
            <div className="text-[18px] font-semibold leading-none">{m ? formatCurrency(m.totalValue) : "--"}</div>
            {trendPct !== null && (
              <div className={`inline-flex items-center gap-1 text-[12px] font-medium ${trendPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {trendPct >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                <span>{`${Math.abs(trendPct).toFixed(2)}%`}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="py-1.5">
          <CardTitle className="text-slate-700 text-[13px]">Available + Positions</CardTitle>
        </CardHeader>
        <CardContent className="pb-2 text-[13px]">
          <div className="flex items-center justify-between"><span className="text-slate-600">Available</span><span className="font-semibold text-[15px]">{m ? formatCurrency(m.balance) : "--"}</span></div>
          <div className="mt-1 flex items-center justify-between"><span className="text-slate-600">Open Positions</span><span className="font-semibold text-[15px]">{m ? m.openPositions : "--"}</span></div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="py-1.5">
          <CardTitle className="text-slate-700 text-[13px]">P&L</CardTitle>
        </CardHeader>
        <CardContent className="pb-2 text-[13px]">
          <div className="flex items-center justify-between"><span className="text-slate-600">Total</span><span className={`font-semibold text-[15px] ${m && m.totalPnL >= 0 ? "text-emerald-600" : "text-red-600"}`}>{m ? formatCurrency(m.totalPnL) : "--"}</span></div>
          <div className="mt-1 flex items-center justify-between"><span className="text-slate-600">Daily</span><span className="font-semibold text-[15px]">{m ? formatCurrency(m.dailyPnL) : "--"}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
