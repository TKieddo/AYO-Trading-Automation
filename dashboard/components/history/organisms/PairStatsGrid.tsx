import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type PairAgg = { symbol: string; trades: number; wins: number; losses: number; winRate: number; volume: number; netPnl: number; avgPnl: number };
type Props = { byPair: { topWinners: PairAgg[]; mostTraded: PairAgg[]; topPnl: PairAgg[] } };

export function PairStatsGrid({ byPair }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle className="text-slate-700 text-[14px]">Top Winning Pairs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Pair</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Win rate</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">W / L</th>
                </tr>
              </thead>
              <tbody>
                {byPair.topWinners.length > 0 ? (
                  byPair.topWinners.map(p => (
                    <tr key={`win-${p.symbol}`} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-800">{p.symbol}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{p.winRate}%</td>
                      <td className="py-3 px-4 text-right text-slate-700">{p.wins} / {p.losses}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-center text-slate-500 text-sm">No trades yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle className="text-slate-700 text-[14px]">Most Traded Pairs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Pair</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Trades</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Volume</th>
                </tr>
              </thead>
              <tbody>
                {byPair.mostTraded.length > 0 ? (
                  byPair.mostTraded.map(p => (
                    <tr key={`mt-${p.symbol}`} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-800">{p.symbol}</td>
                      <td className="py-3 px-4 text-right text-slate-800">{p.trades}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(p.volume)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-center text-slate-500 text-sm">No trades yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle className="text-slate-700 text-[14px]">Top PnL by Pair</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Pair</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Net PnL</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Avg PnL</th>
                </tr>
              </thead>
              <tbody>
                {byPair.topPnl.length > 0 ? (
                  byPair.topPnl.map(p => (
                    <tr key={`pnl-${p.symbol}`} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-800">{p.symbol}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${p.netPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(p.netPnl)}</td>
                      <td className={`py-3 px-4 text-right ${p.avgPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(p.avgPnl)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-center text-slate-500 text-sm">No trades yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


