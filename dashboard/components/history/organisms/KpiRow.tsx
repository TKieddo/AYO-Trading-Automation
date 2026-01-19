import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, DollarSign, Activity, Receipt } from "lucide-react";

type Props = {
  aggregate: { totalTrades: number; winners: number; losers: number; winRate: number; netPnl: number; fees: number };
};

export function KpiRow({ aggregate }: Props) {
  const isPositive = aggregate.netPnl >= 0;
  const limeGreen = "#d0d926"; // Brand lime green color
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Net PnL Card */}
      <Card className="rounded-[14px] bg-black ring-1 ring-slate-800 hover:ring-slate-700 transition-all overflow-hidden relative group p-0">
        {/* Premium Background Graphics - Lime Green Brand Color */}
        <div className="absolute inset-0 opacity-20">
          {/* Abstract Geometric Shapes */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -mr-12 -mt-12" style={{ backgroundColor: `${limeGreen}40` }} />
          <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full blur-2xl -ml-10 -mb-10" style={{ backgroundColor: `${limeGreen}30` }} />
          
          {/* Diagonal Light Rays */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 100 L200 0" stroke={limeGreen} strokeWidth="2" strokeOpacity="0.25" />
            <path d="M0 150 L200 50" stroke={limeGreen} strokeWidth="1.5" strokeOpacity="0.2" />
          </svg>
          
          {/* Orb Pattern */}
          <div className="absolute top-3 right-6 w-12 h-12 rounded-full blur-xl" style={{ backgroundColor: `${limeGreen}20` }} />
        </div>
        
        <CardHeader className="py-1 pb-0 px-3 pt-2 mb-0 relative z-10">
          <CardTitle className="text-[9px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1">
            <DollarSign className="w-2.5 h-2.5" />
            Net PnL
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-0 px-3 relative z-10">
          <div className={`text-base font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(aggregate.netPnl)}
          </div>
          <div className="flex items-center gap-1 mt-0">
            {isPositive ? (
              <TrendingUp className="w-2 h-2 text-emerald-400" />
            ) : (
              <TrendingDown className="w-2 h-2 text-red-400" />
            )}
            <span className="text-[8px] text-slate-500">
              {isPositive ? "Profit" : "Loss"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Win Rate Card */}
      <Card className="rounded-[14px] bg-black ring-1 ring-slate-800 hover:ring-slate-700 transition-all overflow-hidden relative group p-0">
        {/* Premium Background Graphics - Lime Green Brand Color */}
        <div className="absolute inset-0 opacity-20">
          {/* Abstract Geometric Shapes */}
          <div className="absolute top-0 right-0 w-28 h-28 rounded-full blur-3xl -mr-14 -mt-14" style={{ backgroundColor: `${limeGreen}40` }} />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl -ml-12 -mb-12" style={{ backgroundColor: `${limeGreen}30` }} />
          <div className="absolute top-1/2 left-1/2 w-16 h-16 rounded-full blur-xl -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${limeGreen}25` }} />
          
          {/* Radial Pattern */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" fill={limeGreen} fillOpacity="0.15" />
            <circle cx="100" cy="100" r="50" fill={limeGreen} fillOpacity="0.1" />
          </svg>
          
          {/* Hexagonal Pattern */}
          <div className="absolute top-0 right-0 w-20 h-20">
            <svg viewBox="0 0 100 100" className="w-full h-full opacity-40">
              <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" fill="none" stroke={limeGreen} strokeWidth="2" />
            </svg>
          </div>
        </div>
        
        <CardHeader className="py-1 pb-0 px-3 pt-2 mb-0 relative z-10">
          <CardTitle className="text-[9px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1">
            <Target className="w-2.5 h-2.5" />
            Win Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-0 px-3 relative z-10">
          <div className="text-base font-bold text-white">{aggregate.winRate}%</div>
          <div className="flex items-center gap-1.5 mt-0">
            <span className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
              {aggregate.winners}W
            </span>
            <span className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded bg-red-500/20 text-red-300 ring-1 ring-red-500/30">
              {aggregate.losers}L
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Total Trades Card */}
      <Card className="rounded-[14px] bg-black ring-1 ring-slate-800 hover:ring-slate-700 transition-all overflow-hidden relative group p-0">
        {/* Premium Background Graphics - Lime Green Brand Color */}
        <div className="absolute inset-0 opacity-20">
          {/* Abstract Geometric Shapes */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16" style={{ backgroundColor: `${limeGreen}40` }} />
          <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full blur-2xl -ml-14 -mb-14" style={{ backgroundColor: `${limeGreen}30` }} />
          <div className="absolute top-2 right-2 w-20 h-20 rounded-full blur-xl" style={{ backgroundColor: `${limeGreen}25` }} />
          
          {/* Circuit Pattern */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" opacity="0.4">
            <path d="M20 100 Q50 50, 100 50 T180 100" stroke={limeGreen} strokeWidth="2" fill="none" strokeOpacity="0.3" />
            <path d="M20 100 Q50 150, 100 150 T180 100" stroke={limeGreen} strokeWidth="2" fill="none" strokeOpacity="0.3" />
            <circle cx="100" cy="100" r="8" fill={limeGreen} fillOpacity="0.4" />
            <circle cx="50" cy="100" r="4" fill={limeGreen} fillOpacity="0.4" />
            <circle cx="150" cy="100" r="4" fill={limeGreen} fillOpacity="0.4" />
          </svg>
          
          {/* Diamond Pattern */}
          <div className="absolute bottom-3 left-3 w-12 h-12 rotate-45">
            <div className="w-full h-full border rounded-sm" style={{ borderColor: `${limeGreen}30` }} />
          </div>
        </div>
        
        <CardHeader className="py-1 pb-0 px-3 pt-2 mb-0 relative z-10">
          <CardTitle className="text-[9px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1">
            <Activity className="w-2.5 h-2.5" />
            Total Trades
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-0 px-3 relative z-10">
          <div className="text-base font-bold text-white">{aggregate.totalTrades}</div>
          <div className="text-[8px] text-slate-500 mt-0">
            All time
          </div>
        </CardContent>
      </Card>

      {/* Fees Paid Card */}
      <Card className="rounded-[14px] bg-black ring-1 ring-slate-800 hover:ring-slate-700 transition-all overflow-hidden relative group p-0">
        {/* Premium Background Graphics - Lime Green Brand Color */}
        <div className="absolute inset-0 opacity-20">
          {/* Abstract Geometric Shapes */}
          <div className="absolute top-0 right-0 w-28 h-28 rounded-full blur-3xl -mr-14 -mt-14" style={{ backgroundColor: `${limeGreen}40` }} />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl -ml-12 -mb-12" style={{ backgroundColor: `${limeGreen}30` }} />
          <div className="absolute top-1/3 right-1/4 w-16 h-16 rounded-full blur-xl" style={{ backgroundColor: `${limeGreen}25` }} />
          
          {/* Geometric Grid Pattern */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" opacity="0.3">
            <defs>
              <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke={limeGreen} strokeWidth="1" strokeOpacity="0.4" />
              </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#gridPattern)" />
          </svg>
          
          {/* Starburst Pattern */}
          <div className="absolute top-4 right-4">
            <svg width="32" height="32" viewBox="0 0 40 40" className="opacity-40">
              <path d="M20 0 L22 14 L36 18 L22 22 L20 36 L18 22 L4 18 L18 14 Z" fill={limeGreen} fillOpacity="0.5" />
            </svg>
          </div>
          
          {/* Concentric Circles */}
          <div className="absolute bottom-4 left-4 w-16 h-16 border rounded-full" style={{ borderColor: `${limeGreen}25` }} />
          <div className="absolute bottom-5 left-5 w-12 h-12 border rounded-full" style={{ borderColor: `${limeGreen}20` }} />
        </div>
        
        <CardHeader className="py-1 pb-0 px-3 pt-2 mb-0 relative z-10">
          <CardTitle className="text-[9px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1">
            <Receipt className="w-2.5 h-2.5" />
            Fees Paid
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-0 px-3 relative z-10">
          <div className="text-base font-bold text-orange-400">{formatCurrency(aggregate.fees)}</div>
          <div className="text-[8px] text-slate-500 mt-0">
            Total commission
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


