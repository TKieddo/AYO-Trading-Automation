import { TopAssetCard } from "@/components/portfolio/molecules/TopAssetCard";
import type { Asset } from "@/components/portfolio/organisms/AssetsList";

type TopAssetsProps = {
  assets: Asset[];
};

export function TopAssets({ assets }: TopAssetsProps) {
  // Sort by holding value descending and take top 3
  const topAssets = [...assets]
    .sort((a, b) => b.holdingValue - a.holdingValue)
    .slice(0, 3);
  
  const totalPortfolioValue = assets.reduce((sum, a) => sum + a.holdingValue, 0);

  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      {topAssets.map((asset, index) => (
        <TopAssetCard 
          key={asset.symbol} 
          asset={asset} 
          rank={index + 1}
          totalPortfolioValue={totalPortfolioValue}
        />
      ))}
    </div>
  );
}

