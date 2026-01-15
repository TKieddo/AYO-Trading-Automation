import { AssetCard } from "@/components/portfolio/molecules/AssetCard";
import { ChevronUp, ChevronDown } from "lucide-react";

export type Asset = {
  symbol: string;
  name: string;
  logoUrl: string;
  price: number;
  change24h: number;
  holdingQty: number;
  holdingValue: number;
};

type AssetsListProps = {
  assets: Asset[];
  heightClass?: string; // e.g. md:h-[360px]
};

export function AssetsList({ assets, heightClass = "md:h-[400px]" }: AssetsListProps) {
  const isScrollable = assets.length > 5;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-800 font-semibold text-sm">Assets</h3>
        <div className="text-slate-500 text-xs flex items-center gap-1 select-none">
          <ChevronUp className="h-3.5 w-3.5" />
          <span>Scroll</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className={`space-y-2.5 ${heightClass} overflow-y-auto pr-1 ${isScrollable ? '' : ''}`}>
        {assets.map((a) => (
          <AssetCard key={a.symbol} {...a} />
        ))}
      </div>
    </div>
  );
}


