import { HomeTopbar } from "../organisms/HomeTopbar";
import { PerformanceSection } from "../organisms/PerformanceSection";
import { ExploreMarketsSection } from "../organisms/ExploreMarketsSection";
import { RightSidebar } from "../organisms/RightSidebar";

interface HomeTemplateProps {
  performanceData: {
    total: string;
    period: string;
    change: string;
    strategies?: Array<{
      pair: string;
      profit: string;
      profitPercent: string;
      performance: string;
      category?: "crypto" | "forex";
    }>;
    cryptoStrategies?: Array<{
      pair: string;
      profit: string;
      profitPercent: string;
      performance: string;
    }>;
    forexStrategies?: Array<{
      pair: string;
      profit: string;
      profitPercent: string;
      performance: string;
    }>;
    metrics?: Array<{
      icon: React.ReactNode;
      iconVariant?: "yellow" | "white";
      value: string;
      label: string;
      progress?: number;
    }>;
    rightSidebar?: {
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
  };
  marketsData: Array<{
    pair: string[];
    changePercent: string;
    value: string;
    sliderValue: number;
    price: string;
  }>;
}

export function HomeTemplate({
  performanceData,
  marketsData
}: HomeTemplateProps) {
  return (
    <div className="min-h-screen bg-[#00000a] flex flex-col relative">
      {/* Background image covering entire hero section */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: 'url(/hero-backgroung.jpg)' }}
      ></div>
      
      <HomeTopbar />
      
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-auto relative z-10">
        {/* Performance Section - Left Side Only */}
        <div className="col-span-8">
          <PerformanceSection data={performanceData} />
        </div>

        {/* Right Sidebar - Separate */}
        {performanceData.rightSidebar && (
          <div className="col-span-4">
            <RightSidebar
              nftImage={performanceData.rightSidebar.nftImage}
              progressValue={performanceData.rightSidebar.progressValue}
              progressLabel={performanceData.rightSidebar.progressLabel}
            />
          </div>
        )}

        {/* Explore Markets Section - Full Width */}
        <div className="col-span-12">
          <ExploreMarketsSection markets={marketsData} />
        </div>
      </main>
    </div>
  );
}
