type AssetCardProps = {
  symbol: string; // e.g. BTC
  name: string;   // e.g. Bitcoin
  logoUrl: string;
  price: number; // current price
  change24h: number; // percent
  holdingQty: number;
  holdingValue: number;
};

export function AssetCard({ symbol, name, logoUrl, price, change24h, holdingQty, holdingValue }: AssetCardProps) {
  // Ensure change24h is a valid number, handle NaN, Infinity, and null/undefined
  const validChange24h = (change24h != null && !isNaN(change24h) && isFinite(change24h)) ? change24h : 0;
  
  // Handle -0 case: convert -0 to 0
  const normalizedChange = Object.is(validChange24h, -0) ? 0 : validChange24h;
  
  // Don't round small values - show actual change even if small
  // Only round to 0 if it's truly zero (within floating point precision)
  const changeDisplay = Math.abs(normalizedChange) < 0.0001 ? 0 : normalizedChange;
  
  const isUp = changeDisplay >= 0;
  
  // Format percentage with proper sign and 2 decimal places
  const changeFormatted = changeDisplay === 0
    ? '0.00%'
    : (isUp ? `+${changeDisplay.toFixed(2)}%` : `${changeDisplay.toFixed(2)}%`);
  
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-black px-2.5 py-1.5 ring-1 ring-white/10 transition">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition">
        <div className="h-full w-full bg-[radial-gradient(200px_110px_at_95%_-20%,#F4FF6E_12%,transparent_55%)]" />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-6 w-6 rounded-full ring-1 ring-black/10 bg-white text-black grid place-items-center text-[10px] font-extrabold tracking-wide">
          {symbol.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-white font-semibold text-[12px] leading-5">{name}</div>
            <div className={`text-[10px] font-semibold ${isUp ? 'text-emerald-700' : 'text-orange-400'}`}>{changeFormatted}</div>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-300">
            <div className="truncate">{symbol} · ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</div>
            <div className="font-semibold text-white">${holdingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="text-[10px] text-slate-400">Qty {holdingQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })}</div>
        </div>
      </div>
    </div>
  );
}


