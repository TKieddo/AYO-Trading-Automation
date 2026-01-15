"use client";

type AssetCardProps = {
  symbol: string;
  price: number;
  changePercent: number;
  icon?: string;
};

// Color palettes - dynamically assigned based on symbol hash
const colorPalettes = [
  { gradient: "from-emerald-400 via-emerald-500 to-emerald-600", bgGradient: "from-emerald-50/80 via-emerald-50/60 to-emerald-50/40", chartColor: "#10B981", badge: "bg-emerald-500" },
  { gradient: "from-blue-400 via-blue-500 to-blue-600", bgGradient: "from-blue-50/80 via-blue-50/60 to-blue-50/40", chartColor: "#3B82F6", badge: "bg-blue-500" },
  { gradient: "from-purple-400 via-purple-500 to-purple-600", bgGradient: "from-purple-50/80 via-purple-50/60 to-purple-50/40", chartColor: "#8B5CF6", badge: "bg-purple-500" },
  { gradient: "from-pink-400 via-pink-500 to-pink-600", bgGradient: "from-pink-50/80 via-pink-50/60 to-pink-50/40", chartColor: "#EC4899", badge: "bg-pink-500" },
  { gradient: "from-indigo-400 via-indigo-500 to-indigo-600", bgGradient: "from-indigo-50/80 via-indigo-50/60 to-indigo-50/40", chartColor: "#6366F1", badge: "bg-indigo-500" },
  { gradient: "from-orange-400 via-orange-500 to-orange-600", bgGradient: "from-orange-50/80 via-orange-50/60 to-orange-50/40", chartColor: "#F97316", badge: "bg-orange-500" },
  { gradient: "from-cyan-400 via-cyan-500 to-cyan-600", bgGradient: "from-cyan-50/80 via-cyan-50/60 to-cyan-50/40", chartColor: "#06B6D4", badge: "bg-cyan-500" },
  { gradient: "from-violet-400 via-violet-500 to-violet-600", bgGradient: "from-violet-50/80 via-violet-50/60 to-violet-50/40", chartColor: "#8B5CF6", badge: "bg-violet-500" },
  { gradient: "from-teal-400 via-teal-500 to-teal-600", bgGradient: "from-teal-50/80 via-teal-50/60 to-teal-50/40", chartColor: "#14B8A6", badge: "bg-teal-500" },
  { gradient: "from-amber-400 via-amber-500 to-amber-600", bgGradient: "from-amber-50/80 via-amber-50/60 to-amber-50/40", chartColor: "#F59E0B", badge: "bg-amber-500" },
];

// Simple hash function to get consistent color based on symbol
function getColorForSymbol(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorPalettes[Math.abs(hash) % colorPalettes.length];
}

export function AssetCard({ symbol, price, changePercent, icon }: AssetCardProps) {
  const isPositive = changePercent >= 0;
  const style = getColorForSymbol(symbol);
  const assetSymbol = symbol.split('/')[0]; // Extract ETH from ETH/USD
  
  // Override badge color for ETH to black
  const badgeColor = assetSymbol.toUpperCase() === "ETH" ? "bg-black" : style.badge;

  // Generate chart with sharp highs and lows matching main chart style
  // Entry point is at position 2 (about 10% from start)
  const entryPointIndex = 2;
  const numPoints = 14; // Fewer points for sharper angles
  const chartPoints: string[] = [];
  const entryPrice = 50; // Entry Y coordinate (middle)
  
  // Generate price action with sharp peaks and valleys
  const trend = isPositive ? 1 : -1;
  
  // Define segments with sharp transitions
  const segments = [
    { start: 0, end: entryPointIndex, startY: entryPrice - (trend * 4), endY: entryPrice }, // Before entry
    { start: entryPointIndex, end: 4, startY: entryPrice, endY: entryPrice + (trend * 12) + (isPositive ? 8 : -8) }, // Sharp rise/drop
    { start: 4, end: 6, startY: entryPrice + (trend * 12) + (isPositive ? 8 : -8), endY: entryPrice + (trend * 15) }, // Continue
    { start: 6, end: 9, startY: entryPrice + (trend * 15), endY: entryPrice + (trend * 8) + (isPositive ? -6 : 6) }, // Sharp opposite
    { start: 9, end: 11, startY: entryPrice + (trend * 8) + (isPositive ? -6 : 6), endY: entryPrice + (trend * 18) }, // Trend up
    { start: 11, end: 13, startY: entryPrice + (trend * 18), endY: entryPrice + (trend * 12) + (isPositive ? 5 : -5) }, // Another peak
    { start: 13, end: numPoints - 1, startY: entryPrice + (trend * 12) + (isPositive ? 5 : -5), endY: entryPrice + (trend * 10) }, // End
  ];
  
  for (let i = 0; i < numPoints; i++) {
    const x = (i / (numPoints - 1)) * 100;
    let currentY = entryPrice;
    
    // Find which segment this point belongs to
    for (const segment of segments) {
      if (i >= segment.start && i <= segment.end) {
        const segmentProgress = (i - segment.start) / (segment.end - segment.start || 1);
        currentY = segment.startY + (segment.endY - segment.startY) * segmentProgress;
        break;
      }
    }
    
    // Keep within reasonable bounds
    currentY = Math.max(15, Math.min(85, currentY));
    
    chartPoints.push(`${x},${currentY}`);
  }

  // Entry point coordinates for the dot
  const entryX = (entryPointIndex / (numPoints - 1)) * 100;
  const entryY = entryPrice;

  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-black/5 transition-all hover:shadow-md`}>
      {/* Beautiful colorful background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${style.bgGradient} opacity-50`} />
      
      <div className="relative p-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {/* Asset Symbol Badge */}
            <div className={`h-6 w-6 rounded-full ${badgeColor} text-white grid place-items-center text-[10px] font-bold ring-2 ring-white/50 shrink-0`}>
              {assetSymbol}
            </div>
            <span className="text-[10px] font-semibold text-[#1A1A1A]">{symbol}</span>
          </div>
          {/* Percentage Change Pill */}
          <div
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
              isPositive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-orange-50 text-orange-600"
            }`}
          >
            {isPositive ? "▲" : "▼"} {Math.abs(changePercent).toFixed(2)}%
          </div>
        </div>
        
        {/* Price */}
        <div className="text-base font-bold text-[#1A1A1A] mb-2">
          ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        
         {/* Summary Chart with Entry Point - Shows sharp highs and lows since entry */}
         <div className="h-10 w-full relative">
           <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" className="overflow-visible">
             <defs>
               {/* Gradient for area under line - matches main chart style */}
               <linearGradient id={`gradient-${assetSymbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
                 <stop offset="0%" stopColor={style.chartColor} stopOpacity={0.3} />
                 <stop offset="50%" stopColor={style.chartColor} stopOpacity={0.2} />
                 <stop offset="100%" stopColor={style.chartColor} stopOpacity={0.05} />
               </linearGradient>
             </defs>

             {/* Create area path from line to bottom for gradient fill */}
             {(() => {
               const pathData = chartPoints.map((point, i) => {
                 const [x, y] = point.split(',').map(Number);
                 return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
               }).join(' ');
               const lastPoint = chartPoints[chartPoints.length - 1].split(',').map(Number);
               const firstPoint = chartPoints[0].split(',').map(Number);
               const areaPath = `${pathData} L ${lastPoint[0]} 100 L ${firstPoint[0]} 100 Z`;
               
               return (
                 <path
                   d={areaPath}
                   fill={`url(#gradient-${assetSymbol})`}
                 />
               );
             })()}

             {/* Main line with sharp angles - matches main chart style */}
             <polyline
               points={chartPoints.join(" ")}
               fill="none"
               stroke={style.chartColor}
               strokeWidth="2.5"
               strokeLinecap="round"
               strokeLinejoin="round"
               vectorEffect="non-scaling-stroke"
             />
             
             {/* Entry point dot/knot - more visible */}
             <circle
               cx={entryX}
               cy={entryY}
               r="4"
               fill={style.chartColor}
               stroke="white"
               strokeWidth="2.5"
               className="drop-shadow-md"
             />
             
             {/* Inner highlight on dot */}
             <circle
               cx={entryX}
               cy={entryY}
               r="2"
               fill="white"
               opacity="0.95"
             />
           </svg>
         </div>
      </div>
    </div>
  );
}

