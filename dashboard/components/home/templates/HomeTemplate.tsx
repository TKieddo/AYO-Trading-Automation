import { HomeTopbar } from "../organisms/HomeTopbar";
import { PerformanceSection } from "../organisms/PerformanceSection";
import { ExploreMarketsSection } from "../organisms/ExploreMarketsSection";
import { RightColumn } from "../organisms/RightColumn";

interface HomeTemplateProps {
  performanceData: {
    total: string;
    period: string;
    change: string;
    metrics: Array<{
      icon: React.ReactNode;
      iconVariant?: "yellow" | "white";
      value: string;
      label: string;
      progress?: number;
    }>;
  };
  marketsData: Array<{
    pair: string[];
    changePercent: string;
    value: string;
    sliderValue: number;
    price: string;
  }>;
  rightColumnData: {
    nftImage?: React.ReactNode;
    progressValue?: number;
    progressLabel?: string;
    activityChartData?: {
      data: number[];
      labels: string[];
      maxValue: string;
      title: string;
    };
    notifications?: Array<{
      icon: React.ReactNode;
      date: string;
      avatar?: React.ReactNode;
      title: string;
      amount?: string;
      variant?: "default" | "payment";
    }>;
  };
}

export function HomeTemplate({
  performanceData,
  marketsData,
  rightColumnData
}: HomeTemplateProps) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <HomeTopbar />
      
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-auto">
        {/* Full Width Performance Section */}
        <div className="col-span-12">
          <PerformanceSection data={performanceData} />
        </div>

        {/* Left Column - Explore Markets */}
        <div className="col-span-7 flex flex-col gap-6">
          <ExploreMarketsSection markets={marketsData} />
        </div>

        {/* Right Column */}
        <div className="col-span-5">
          <RightColumn {...rightColumnData} />
        </div>
      </main>
    </div>
  );
}
