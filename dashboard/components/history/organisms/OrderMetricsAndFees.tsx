import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { BarChart3, DollarSign, TrendingUp, TrendingDown, Receipt, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

type OrderMetrics = {
  total: number;
  open: number;
  filled: number;
  canceled: number;
  rejected: number;
  openPct: number;
  filledPct: number;
  canceledPct: number;
  rejectedPct: number;
};

type FeesAndProfit = {
  totalFees: number;
  totalPnL: number;
  netProfit: number; // PnL - Fees
  avgFeePerTrade: number;
  feeToPnLRatio: number; // What % of PnL goes to fees
  profitMargin: number; // Net profit / Total PnL
};

type Props = {
  orderMetrics: OrderMetrics;
  feesAndProfit: FeesAndProfit;
};

export function OrderMetricsAndFees({ orderMetrics, feesAndProfit }: Props) {
  const isProfitable = feesAndProfit.netProfit >= 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Order Metrics Card */}
      <Card className="rounded-[24px] bg-black ring-1 ring-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-semibold">Order Metrics</span>
            </div>
            <div className="inline-flex items-center rounded-full bg-white/20 backdrop-blur text-white px-3 py-1 text-xs font-medium">
              {orderMetrics.total} total
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderMetrics.total > 0 ? (
              <>
                {/* Open Orders */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-blue-300" />
                    <div>
                      <div className="text-xs text-white/80">Open</div>
                      <div className="text-sm font-semibold text-white">{orderMetrics.open}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">{orderMetrics.openPct}%</div>
                    <div className="text-xs text-white/40">of total</div>
                  </div>
                </div>

                {/* Filled Orders */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <div>
                      <div className="text-xs text-white/80">Filled</div>
                      <div className="text-sm font-semibold text-white">{orderMetrics.filled}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">{orderMetrics.filledPct}%</div>
                    <div className="text-xs text-white/40">of total</div>
                  </div>
                </div>

                {/* Canceled Orders */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-4 h-4 text-slate-300" />
                    <div>
                      <div className="text-xs text-white/80">Canceled</div>
                      <div className="text-sm font-semibold text-white">{orderMetrics.canceled}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">{orderMetrics.canceledPct}%</div>
                    <div className="text-xs text-white/40">of total</div>
                  </div>
                </div>

                {/* Rejected Orders */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-red-300" />
                    <div>
                      <div className="text-xs text-white/80">Rejected</div>
                      <div className="text-sm font-semibold text-white">{orderMetrics.rejected}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">{orderMetrics.rejectedPct}%</div>
                    <div className="text-xs text-white/40">of total</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-white/60 text-xs">No orders yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fees & Profit Summary Card */}
      <Card className={`rounded-[24px] bg-gradient-to-br ${isProfitable 
        ? "from-[#10b981] via-[#059669] to-[#047857] ring-1 ring-emerald-300" 
        : "from-[#f59e0b] via-[#d97706] to-[#b45309] ring-1 ring-orange-300"}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-semibold">Fees & Profit</span>
            </div>
            <div className={`inline-flex items-center rounded-full ${isProfitable ? "bg-emerald-50/20" : "bg-orange-50/20"} backdrop-blur text-white px-3 py-1 text-xs font-medium`}>
              {isProfitable ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {formatCurrency(feesAndProfit.netProfit)}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {feesAndProfit.totalPnL !== 0 || feesAndProfit.totalFees > 0 ? (
              <>
                {/* Total Fees */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20">
                  <div className="flex items-center gap-3">
                    <Receipt className="w-4 h-4 text-white/80" />
                    <div>
                      <div className="text-xs text-white/80">Total Fees</div>
                      <div className="text-sm font-semibold text-white">{formatCurrency(feesAndProfit.totalFees)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">Avg: {formatCurrency(feesAndProfit.avgFeePerTrade)}</div>
                    <div className="text-xs text-white/40">per trade</div>
                  </div>
                </div>

                {/* Gross PnL */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-4 h-4 text-white/80" />
                    <div>
                      <div className="text-xs text-white/80">Gross PnL</div>
                      <div className={`text-sm font-semibold ${feesAndProfit.totalPnL >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                        {formatCurrency(feesAndProfit.totalPnL)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">Before fees</div>
                  </div>
                </div>

                {/* Net Profit (After Fees) */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/15 backdrop-blur ring-2 ring-white/30">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isProfitable ? "bg-emerald-500/30" : "bg-orange-500/30"}`}>
                      <DollarSign className={`w-5 h-5 ${isProfitable ? "text-emerald-200" : "text-orange-200"}`} />
                    </div>
                    <div>
                      <div className="text-xs text-white/80">Net Profit</div>
                      <div className={`text-lg font-bold ${isProfitable ? "text-emerald-100" : "text-orange-100"}`}>
                        {formatCurrency(feesAndProfit.netProfit)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">
                      {feesAndProfit.profitMargin > 0 ? "+" : ""}
                      {feesAndProfit.profitMargin.toFixed(1)}%
                    </div>
                    <div className="text-xs text-white/40">margin</div>
                  </div>
                </div>

                {/* Fee Impact */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20">
                  <div className="text-xs text-white/80">Fee Impact</div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">{feesAndProfit.feeToPnLRatio.toFixed(2)}%</div>
                    <div className="text-xs text-white/40">of gross PnL</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-white/60 text-xs">No trading data yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

