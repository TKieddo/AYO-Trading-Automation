import { BalanceWidget } from "@/components/portfolio/organisms/BalanceWidget";
import { RecentTransactions } from "@/components/portfolio/organisms/RecentTransactions";
import { TotalRateChart } from "@/components/portfolio/organisms/TotalRateChart";
import { PortfolioActivityTimeline } from "@/components/portfolio/organisms/PortfolioActivityTimeline";
import { TopAssets } from "@/components/portfolio/organisms/TopAssets";
import type { Transaction } from "@/components/portfolio/molecules/TransactionItem";
import { AssetsList, type Asset } from "@/components/portfolio/organisms/AssetsList";

type PortfolioTemplateProps = {
  transactions: Transaction[];
  assets: Asset[];
  totalValue?: string;
  availableBalance?: string;
  delta?: string;
  deltaValue?: number;
  dayChange?: number;
  weekChange?: number;
  monthChange?: number;
};

export function PortfolioTemplate({ 
  transactions, 
  assets, 
  totalValue = "$0.00", 
  availableBalance,
  delta = "+0.0%", 
  deltaValue = 0,
  dayChange = 0,
  weekChange = 0,
  monthChange = 0
}: PortfolioTemplateProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-[320px_120px] auto-rows-auto gap-x-3 gap-y-3 md:gap-y-0">
          <div className="h-full md:pb-4">
            <BalanceWidget 
              currency="USD" 
              balance={totalValue} 
              availableBalance={availableBalance}
              delta={delta} 
              deltaValue={deltaValue}
              dayChange={dayChange}
              weekChange={weekChange}
              monthChange={monthChange}
            />
          </div>
          <div className="space-y-2 row-span-2 self-stretch">
            <AssetsList assets={assets} heightClass="md:h-[400px]" />
          </div>
          <div className="h-full mb-[60px]">
            <TopAssets assets={assets} />
          </div>
          <div className="md:col-span-2 mt-[40px] mb-6">
            <TotalRateChart currentValue={assets.reduce((sum, a) => sum + a.holdingValue, 0)} />
          </div>
        </div>
      </div>
      <div>
        <PortfolioActivityTimeline />
      </div>
    </div>
  );
}


