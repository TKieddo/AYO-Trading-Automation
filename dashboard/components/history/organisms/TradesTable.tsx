import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Receipt } from "lucide-react";
import { HistoryTrade } from "../types";
import { SidePill } from "../atoms/Pills";

export function TradesTable({ rows }: { rows: HistoryTrade[] }) {
  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Receipt className="w-4 h-4" /> Trades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Symbol</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Side</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Size</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Price</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Fee</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">PnL</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map(t => {
                  const isWin = t.pnl >= 0;
                  return (
                    <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-600">{new Date(t.timestamp).toLocaleString()}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{t.symbol}</td>
                      <td className="py-3 px-4"><SidePill side={t.side} /></td>
                      <td className="py-3 px-4 text-right text-slate-800">{formatNumber(t.size, 6)}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(t.price)}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(t.fee)}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${isWin ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(t.pnl)}</td>
                    </tr>
                  );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-500 text-sm">No trades found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


