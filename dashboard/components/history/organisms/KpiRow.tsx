import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, DollarSign, Activity, Receipt } from "lucide-react";

type Props = {
  aggregate: { totalTrades: number; winners: number; losers: number; winRate: number; netPnl: number; fees: number };
};

export function KpiRow({ aggregate }: Props) {
  const isPositive = aggregate.netPnl >= 0;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Net PnL Card */}
      <Card className="rounded-[14px] bg-black ring-1 ring-slate-800 hover:ring-slate-700 transition-all overflow-hidden relative group">
        {/* Premium Background Graphics */}
        <div className="absolute inset-0 opacity-40">
          {/* Gradient Mesh */}
          <div className={`absolute inset-0 bg-gradient-to-br ${isPositive 
            ? 'from-emerald-500/50 via-emerald-600/40 to-transparent' 
            : 'from-red-500/50 via-red-600/40 to-transparent'}`} />
          
          {/* Abstract Geometric Shapes */}
          <div className={`absolute top-0 right-0 w-32 h-32 ${isPositive 
            ? 'bg-emerald-500/40' 
            : 'bg-red-500/40'} rounded-full blur-3xl -mr-16 -mt-16`} />
          <div className={`absolute bottom-0 left-0 w-24 h-24 ${isPositive 
            ? 'bg-emerald-400/30' 
            : 'bg-red-400/30'} rounded-full blur-2xl -ml-12 -mb-12`} />
          
          {/* Diagonal Light Rays */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="pnlGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.4" />
                <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 100 L200 0" stroke="url(#pnlGradient1)" strokeWidth="2" />
            <path d="M0 150 L200 50" stroke="url(#pnlGradient1)" strokeWidth="1.5" />
          </svg>
          
          {/* Orb Pattern */}
          <div className="absolute top-4 right-8 w-16 h-16 rounded-full bg-gradient-radial from-white/20 to-transparent blur-xl" />
        </div>
        
        <CardHeader className="py-2 pb-1 relative z-10">
          <CardTitle className="text-[10px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Net PnL
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-0 relative z-10">
          <div className={`text-xl font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(aggregate.netPnl)}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {isPositive ? (
              <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5 text-red-400" />
            )}
            <span className="text-[9px] text-slate-500">
              {isPositive ? "Profit" : "Loss"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Win Rate Card */}
      <Card className="rounded-[14px] bg-black ring-1 ring-slate-800 hover:ring-slate-700 transition-all overflow-hidden relative group">
        {/* Premium Background Graphics */}
        <div className="absolute inset-0 opacity-50">
          {/* Gradient Mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/50 via-indigo-600/40 to-purple-500/25" />
          
          {/* Abstract Geometric Shapes */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/45 rounded-full blur-3xl -mr-18 -mt-18" />
          <div className="absolute bottom-0 left-0 w-28 h-28 bg-indigo-500/40 rounded-full blur-2xl -ml-14 -mb-14" />
          <div className="absolute top-1/2 left-1/2 w-20 h-20 bg-purple-500/35 rounded-full blur-xl -translate-x-1/2 -translate-y-1/2" />
          
          {/* Radial Pattern */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="winGradient">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="100" r="80" fill="url(#winGradient)" />
            <circle cx="100" cy="100" r="50" fill="url(#winGradient)" opacity="0.7" />
          </svg>
          
          {/* Hexagonal Pattern */}
          <div className="absolute top-0 right-0 w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
              <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" fill="none" stroke="#3b82f6" strokeWidth="2" />
            </svg>
          </div>
        </div>
        
        <CardHeader className="py-2 pb-1 relative z-10">
          <CardTitle className="text-[10px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1">
            <Target className="w-3 h-3" />
            Win Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-0 relative z-10">
          <div className="text-xl font-bold text-white">{aggregate.winRate}%</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
              {aggregate.winners}W
            </span>
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-300 ring-1 ring-red-500/30">
              {aggregate.losers}L
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Total Trades Card */}
      <Card className="rounded-[14px] bg-black ring-1 ring-slate-800 hover:ring-slate-700 transition-all overflow-hidden relative group">
        {/* Premium Background Graphics */}
        <div className="absolute inset-0 opacity-50">
          {/* Gradient Mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/50 via-pink-600/40 to-fuchsia-500/25" />
          
          {/* Abstract Geometric Shapes */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/45 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500/40 rounded-full blur-2xl -ml-16 -mb-16" />
          <div className="absolute top-2 right-2 w-24 h-24 bg-fuchsia-500/35 rounded-full blur-xl" />
          
          {/* Circuit Pattern */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" opacity="0.7">
            <path d="M20 100 Q50 50, 100 50 T180 100" stroke="#a855f7" strokeWidth="2" fill="none" />
            <path d="M20 100 Q50 150, 100 150 T180 100" stroke="#ec4899" strokeWidth="2" fill="none" />
            <circle cx="100" cy="100" r="8" fill="#a855f7" opacity="0.8" />
            <circle cx="50" cy="100" r="4" fill="#ec4899" opacity="0.8" />
            <circle cx="150" cy="100" r="4" fill="#ec4899" opacity="0.8" />
          </svg>
          
          {/* Diamond Pattern */}
          <div className="absolute bottom-4 left-4 w-16 h-16 rotate-45">
            <div className="w-full h-full border border-purple-400/50 rounded-sm" />
          </div>
        </div>
        
        <CardHeader className="py-2 pb-1 relative z-10">
          <CardTitle className="text-[10px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Total Trades
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-0 relative z-10">
          <div className="text-xl font-bold text-white">{aggregate.totalTrades}</div>
          <div className="text-[9px] text-slate-500 mt-1">
            All time
          </div>
        </CardContent>
      </Card>

      {/* Fees Paid Card */}
      <Card className="rounded-[14px] bg-black ring-1 ring-slate-800 hover:ring-slate-700 transition-all overflow-hidden relative group">
        {/* Premium Background Graphics */}
        <div className="absolute inset-0 opacity-50">
          {/* Gradient Mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/50 via-amber-600/40 to-yellow-500/25" />
          
          {/* Abstract Geometric Shapes */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/45 rounded-full blur-3xl -mr-18 -mt-18" />
          <div className="absolute bottom-0 left-0 w-28 h-28 bg-amber-500/40 rounded-full blur-2xl -ml-14 -mb-14" />
          <div className="absolute top-1/3 right-1/4 w-20 h-20 bg-yellow-500/35 rounded-full blur-xl" />
          
          {/* Geometric Grid Pattern */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" opacity="0.6">
            <defs>
              <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.7" />
              </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#gridPattern)" />
          </svg>
          
          {/* Starburst Pattern */}
          <div className="absolute top-6 right-6">
            <svg width="40" height="40" viewBox="0 0 40 40" className="opacity-70">
              <path d="M20 0 L22 14 L36 18 L22 22 L20 36 L18 22 L4 18 L18 14 Z" fill="#f97316" opacity="0.8" />
            </svg>
          </div>
          
          {/* Concentric Circles */}
          <div className="absolute bottom-6 left-6 w-20 h-20 border border-orange-400/40 rounded-full" />
          <div className="absolute bottom-8 left-8 w-16 h-16 border border-amber-400/40 rounded-full" />
        </div>
        
        <CardHeader className="py-2 pb-1 relative z-10">
          <CardTitle className="text-[10px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1">
            <Receipt className="w-3 h-3" />
            Fees Paid
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-0 relative z-10">
          <div className="text-xl font-bold text-orange-400">{formatCurrency(aggregate.fees)}</div>
          <div className="text-[9px] text-slate-500 mt-1">
            Total commission
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


