import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { HistoryTrade } from "../types";

type Props = {
  winsAndLosses: {
    wins: HistoryTrade[];
    losses: HistoryTrade[];
    winCount: number;
    lossCount: number;
    winPct: number;
    lossPct: number;
    winsTotalPnl: number;
    lossesTotalPnl: number;
    winsAvgPnl: number;
    lossesAvgPnl: number;
  };
};

export function WinsLosses({ winsAndLosses }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="rounded-[24px] bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] ring-1 ring-emerald-300">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800"><ArrowUpRight className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold">Wins</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-[10px]">{winsAndLosses.winCount} trades</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-[10px]">{winsAndLosses.winPct}%</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-[10px]">Σ {formatCurrency(winsAndLosses.winsTotalPnl)}</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-[10px]">µ {formatCurrency(winsAndLosses.winsAvgPnl)}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl ring-1 ring-emerald-300 overflow-hidden bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a]">
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white/60 backdrop-blur">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Pair</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-700">Size</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-700">Px</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-700">Fee</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-700">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {winsAndLosses.wins.length > 0 ? (
                    winsAndLosses.wins.map(t => {
                      const pnl = t.pnl != null ? t.pnl : 0;
                      return (
                        <tr key={`win-${t.id}`} className="border-b border-white/50 hover:bg-white/30">
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{new Date(t.timestamp).toLocaleString()}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{t.symbol}</td>
                          <td className="py-2 px-3 text-right text-slate-800">{formatNumber(t.size, 6)}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(t.price)}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(t.fee)}</td>
                          <td className="py-2 px-3 text-right font-semibold text-emerald-700">{formatCurrency(pnl)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 px-3 text-center text-slate-600 text-xs">No winning trades yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] bg-gradient-to-br from-[#ffe0f5] via-[#f26ec5] to-[#d9269d] ring-1 ring-pink-300">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800"><ArrowDownRight className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold">Losses</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 px-2 py-0.5 text-[10px]">{winsAndLosses.lossCount} trades</span>
              <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 px-2 py-0.5 text-[10px]">{winsAndLosses.lossPct}%</span>
              <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 px-2 py-0.5 text-[10px]">Σ {formatCurrency(winsAndLosses.lossesTotalPnl)}</span>
              <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 px-2 py-0.5 text-[10px]">µ {formatCurrency(winsAndLosses.lossesAvgPnl)}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl ring-1 ring-pink-300 overflow-hidden bg-gradient-to-br from-[#ffe0f5] via-[#f26ec5] to-[#d9269d]">
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white/60 backdrop-blur">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Pair</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-700">Size</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-700">Px</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-700">Fee</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-700">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {winsAndLosses.losses.length > 0 ? (
                    winsAndLosses.losses.map(t => {
                      const pnl = t.pnl != null ? t.pnl : 0;
                      return (
                        <tr key={`loss-${t.id}`} className="border-b border-white/50 hover:bg-white/30">
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{new Date(t.timestamp).toLocaleString()}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{t.symbol}</td>
                          <td className="py-2 px-3 text-right text-slate-800">{formatNumber(t.size, 6)}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(t.price)}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(t.fee)}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900">{formatCurrency(pnl)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 px-3 text-center text-slate-600 text-xs">No losing trades yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


