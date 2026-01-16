import { HomeTopbar } from "../organisms/HomeTopbar";
import { PerformanceSection } from "../organisms/PerformanceSection";
import { ExploreMarketsSection } from "../organisms/ExploreMarketsSection";
import { RightSidebar } from "../organisms/RightSidebar";
import { ActivitySection } from "../organisms/ActivitySection";

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
    <div className="min-h-screen bg-[#e8eaec] flex flex-col">
      <HomeTopbar />
      
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-auto">
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

        {/* Activity Section and Explore Markets Section - Side by Side */}
        <div className="col-span-6">
          {performanceData.rightSidebar?.activityChartData && (
            <ActivitySection 
              chartData={performanceData.rightSidebar.activityChartData} 
            />
          )}
        </div>
        <div className="col-span-6">
          <ExploreMarketsSection markets={marketsData} />
        </div>
      </main>
    </div>
  );
}
