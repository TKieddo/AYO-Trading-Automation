import { TrendingUp, TrendingDown } from "lucide-react";
import type { Asset } from "@/components/portfolio/organisms/AssetsList";

type TopAssetCardProps = {
  asset: Asset;
  rank: number; // 1, 2, or 3 for styling
  totalPortfolioValue: number;
};

// Color palettes - dynamically assigned based on symbol hash
const colorPalettes = [
  { gradient: "from-emerald-400 via-emerald-500 to-emerald-600", ring: "ring-emerald-200", badge: "bg-emerald-500" },
  { gradient: "from-blue-400 via-blue-500 to-blue-600", ring: "ring-blue-200", badge: "bg-blue-500" },
  { gradient: "from-purple-400 via-purple-500 to-purple-600", ring: "ring-purple-200", badge: "bg-purple-500" },
  { gradient: "from-pink-400 via-pink-500 to-pink-600", ring: "ring-pink-200", badge: "bg-pink-500" },
  { gradient: "from-indigo-400 via-indigo-500 to-indigo-600", ring: "ring-indigo-200", badge: "bg-indigo-500" },
  { gradient: "from-orange-400 via-orange-500 to-orange-600", ring: "ring-orange-200", badge: "bg-orange-500" },
  { gradient: "from-cyan-400 via-cyan-500 to-cyan-600", ring: "ring-cyan-200", badge: "bg-cyan-500" },
  { gradient: "from-violet-400 via-violet-500 to-violet-600", ring: "ring-violet-200", badge: "bg-violet-500" },
];

// Simple hash function to get consistent color based on symbol
function getColorForSymbol(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorPalettes[Math.abs(hash) % colorPalettes.length];
}

export function TopAssetCard({ asset, rank, totalPortfolioValue }: TopAssetCardProps) {
  // Ensure change24h is a valid number, handle NaN, Infinity, and null/undefined
  const validChange24h = (asset.change24h != null && !isNaN(asset.change24h) && isFinite(asset.change24h)) ? asset.change24h : 0;
  const isPositive = validChange24h >= 0;
  
  // Calculate portfolio percentage - ensure totalPortfolioValue is valid
  const validTotalValue = (totalPortfolioValue != null && !isNaN(totalPortfolioValue) && isFinite(totalPortfolioValue) && totalPortfolioValue > 0) 
    ? totalPortfolioValue 
    : 1; // Avoid division by zero
  const percentage = (asset.holdingValue / validTotalValue) * 100;
  const validPercentage = (percentage != null && !isNaN(percentage) && isFinite(percentage)) ? percentage : 0;
  
  // Format change24h with proper sign
  const changeFormatted = isPositive 
    ? `+${validChange24h.toFixed(1)}%` 
    : `${validChange24h.toFixed(1)}%`;
  
  let style = getColorForSymbol(asset.symbol);
  if (asset.symbol.toUpperCase() === "ETH") {
    style = { ...style, badge: "bg-black" };
  }

  return (
    <div className={`group relative overflow-hidden rounded-xl bg-white ring-1 ${style.ring} hover:shadow-md transition-all`}>
      <div className="absolute inset-0 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition">
        <div className={`h-full w-full bg-gradient-to-br ${style.gradient}`} />
      </div>
      <div className="relative p-2.5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className={`h-6 w-6 rounded-full ${style.badge} text-white grid place-items-center text-[10px] font-bold ring-1 ring-white/50 shrink-0`}>
              {asset.symbol}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-600 truncate">{asset.name}</div>
            </div>
          </div>
          <div className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-600'} text-[10px] font-semibold shrink-0`}>
            {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {changeFormatted}
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-extrabold text-slate-900">${asset.holdingValue.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-600">
            <span className="truncate">{asset.holdingQty} {asset.symbol}</span>
            <span className="font-medium text-slate-800 shrink-0 ml-1">{validPercentage.toFixed(1)}%</span>
          </div>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${style.gradient}`}
              style={{ width: `${Math.min(100, Math.max(0, validPercentage))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

