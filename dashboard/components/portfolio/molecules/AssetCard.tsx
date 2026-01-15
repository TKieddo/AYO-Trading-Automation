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
  const isUp = change24h >= 0;
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
            <div className={`text-[10px] font-semibold ${isUp ? 'text-emerald-700' : 'text-orange-400'}`}>{isUp ? '+' : ''}{change24h.toFixed(2)}%</div>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-300">
            <div className="truncate">{symbol} · ${price.toLocaleString()}</div>
            <div className="font-semibold text-white">${holdingValue.toLocaleString()}</div>
          </div>
          <div className="text-[10px] text-slate-400">Qty {holdingQty}</div>
        </div>
      </div>
    </div>
  );
}


