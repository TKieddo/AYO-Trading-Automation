import { MarketPairCard } from "../molecules/MarketPairCard";

interface MarketPair {
  pair: string[];
  changePercent: string;
  value: string;
  sliderValue: number;
  price: string;
}

interface ExploreMarketsSectionProps {
  markets: MarketPair[];
}

export function ExploreMarketsSection({ markets }: ExploreMarketsSectionProps) {
  return (
    <div className="rounded-2xl bg-gray-900 p-6">
      <h2 className="text-white text-lg font-semibold mb-4">Explore markets</h2>
      <div className="grid grid-cols-2 gap-4">
        {markets.map((market, index) => (
          <MarketPairCard
            key={index}
            pair={market.pair}
            changePercent={market.changePercent}
            value={market.value}
            sliderValue={market.sliderValue}
            price={market.price}
          />
        ))}
      </div>
    </div>
  );
}
