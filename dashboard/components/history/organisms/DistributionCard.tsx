import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { PieChart } from "lucide-react";

type Props = {
  distribution: {
    buys: number;
    sells: number;
    winPct: number;
    buyPct: number;
    totalVolume: number;
    avgSize: number;
    avgPnl: number;
    medianPnl: number;
    best: number;
    worst: number;
    wins: number;
    losses: number;
  };
};

export function DistributionCard({ distribution }: Props) {
  return (
    <Card className="rounded-[24px] bg-[#390174] ring-1 ring-violet-600">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-[13px] flex items-center gap-2"><PieChart className="w-3.5 h-3.5" /> Distribution</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-white p-3">
        <div className="grid grid-cols-1 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-white/25 ring-1 ring-white/30 px-1.5 py-0.5 text-[10px] whitespace-nowrap">Avg PnL: <span className={`${distribution.avgPnl >= 0 ? "text-emerald-100" : "text-rose-100"} font-semibold ml-1`}>{formatCurrency(distribution.avgPnl)}</span></span>
            <span className="inline-flex items-center rounded-full bg-white/25 ring-1 ring-white/30 px-1.5 py-0.5 text-[10px] whitespace-nowrap">Median: <span className={`${distribution.medianPnl >= 0 ? "text-emerald-100" : "text-rose-100"} font-semibold ml-1`}>{formatCurrency(distribution.medianPnl)}</span></span>
            <span className="inline-flex items-center rounded-full bg-white/25 ring-1 ring-white/30 px-1.5 py-0.5 text-[10px] whitespace-nowrap">Best: <span className="text-emerald-100 font-semibold ml-1">{formatCurrency(distribution.best)}</span></span>
            <span className="inline-flex items-center rounded-full bg-white/25 ring-1 ring-white/30 px-1.5 py-0.5 text-[10px] whitespace-nowrap">Worst: <span className="text-rose-100 font-semibold ml-1">{formatCurrency(distribution.worst)}</span></span>
          </div>

          <div className="rounded-xl ring-1 ring-white/25 bg-white/10 p-2">
            <div className="flex items-center justify-between text-[11px] text-white mb-1">
              <span>Buys vs Sells</span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className="inline-flex items-center rounded-full bg-emerald-300/30 text-emerald-50 ring-1 ring-emerald-300/40 px-1 py-0.5 text-[9px]">{distribution.buys} Buys</span>
                <span className="inline-flex items-center rounded-full bg-white/25 text-white ring-1 ring-white/30 px-1 py-0.5 text-[9px]">{distribution.sells} Sells</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-emerald-200" style={{ width: `${distribution.buyPct}%` }} />
            </div>
          </div>

          <div className="rounded-xl ring-1 ring-white/25 bg-white/10 p-2">
            <div className="flex items-center justify-between text-[11px] text-white mb-1">
              <span>Wins vs Losses</span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className="inline-flex items-center rounded-full bg-emerald-300/30 text-emerald-50 ring-1 ring-emerald-300/40 px-1 py-0.5 text-[9px]">{distribution.wins} Wins</span>
                <span className="inline-flex items-center rounded-full bg-rose-300/30 text-rose-50 ring-1 ring-rose-300/40 px-1 py-0.5 text-[9px]">{distribution.losses} Losses</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-emerald-200" style={{ width: `${distribution.winPct}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl ring-1 ring-white/25 bg-white/10 p-2">
              <div className="text-[10px] uppercase tracking-wide text-white">Total Volume</div>
              <div className="text-xs font-semibold text-white">{formatCurrency(distribution.totalVolume)}</div>
            </div>
            <div className="rounded-xl ring-1 ring-white/25 bg-white/10 p-2">
              <div className="text-[10px] uppercase tracking-wide text-white">Avg Size</div>
              <div className="text-xs font-semibold text-white">{formatNumber(distribution.avgSize, 6)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl ring-1 ring-white/25 bg-white/10 p-2">
              <div className="text-[10px] uppercase tracking-wide text-white">Avg PnL</div>
              <div className={`${distribution.avgPnl >= 0 ? "text-emerald-100" : "text-rose-100"} text-xs font-semibold`}>{formatCurrency(distribution.avgPnl)}</div>
            </div>
            <div className="rounded-xl ring-1 ring-white/25 bg-white/10 p-2">
              <div className="text-[10px] uppercase tracking-wide text-white">Median PnL</div>
              <div className={`${distribution.medianPnl >= 0 ? "text-emerald-100" : "text-rose-100"} text-xs font-semibold`}>{formatCurrency(distribution.medianPnl)}</div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="inline-flex items-center rounded-full bg-white/20 ring-1 ring-white/30 px-3 py-1 text-[10px] font-semibold text-white min-w-[210px] justify-center whitespace-nowrap">
              <span className="text-white/90 mr-1">Best/Worst:</span>
              <span className="text-emerald-100 mr-1">{formatCurrency(distribution.best)}</span>
              <span className="mx-0.5 text-white/80">-</span>
              <span className="text-rose-100">{formatCurrency(distribution.worst)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


