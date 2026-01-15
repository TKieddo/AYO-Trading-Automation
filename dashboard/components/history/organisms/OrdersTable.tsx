import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { HistoryOrder } from "../types";
import { SidePill, StatusPill } from "../atoms/Pills";

export function OrdersTable({ rows }: { rows: HistoryOrder[] }) {
  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wallet className="w-4 h-4" /> Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Symbol</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Side/Type</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Size</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map(o => (
                    <tr key={o.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-600">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{o.symbol}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <SidePill side={o.side} />
                          <span className="text-xs text-slate-500">{o.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-800">{formatNumber(o.size, 6)}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{o.price ? formatCurrency(o.price) : "—"}</td>
                      <td className="py-3 px-4"><StatusPill status={o.status} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-slate-500 text-sm">No orders found</td>
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


