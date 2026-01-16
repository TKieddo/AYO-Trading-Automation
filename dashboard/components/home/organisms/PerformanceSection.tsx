import { MetricIcon } from "../atoms/MetricIcon";
import { CircularProgress } from "../atoms/CircularProgress";
import { Badge } from "../atoms/Badge";
import { ActivitySection } from "./ActivitySection";

interface PerformanceData {
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
}

interface PerformanceSectionProps {
  data: PerformanceData;
}

export function PerformanceSection({ data }: PerformanceSectionProps) {
  return (
    <div className="relative rounded-2xl bg-gray-900 p-6 overflow-hidden">
      {/* Glowing sphere background */}
      <div className="absolute -right-32 -top-32 w-96 h-96 bg-gradient-to-br from-yellow-400/20 via-orange-500/30 to-yellow-500/20 rounded-full blur-3xl opacity-60"></div>
      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-gradient-to-br from-yellow-400/20 via-orange-500/30 to-yellow-500/20 rounded-full blur-2xl opacity-40"></div>
      
      <div className="relative z-10 grid grid-cols-12 gap-6">
        {/* Left Side - Performance Data and Metrics */}
        <div className="col-span-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-white text-lg font-semibold">Performance</h2>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <div className="mb-6">
            <div className="text-5xl font-bold text-white mb-2">
              {(() => {
                const parts = data.total.split(".");
                if (parts.length === 2) {
                  return (
                    <>
                      {parts[0]}<span className="text-2xl">.{parts[1]} $</span>
                    </>
                  );
                }
                return (
                  <>
                    {data.total}<span className="text-2xl">.00 $</span>
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">{data.period}</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-green-400 text-sm">{data.change}</span>
              </div>
            </div>
          </div>

          {/* Metric List - Vertical Format */}
          <div className="flex flex-col gap-4 mb-6">
            {data.metrics.map((metric, index) => (
              <div key={index} className="flex items-center gap-3">
                <MetricIcon variant={metric.iconVariant}>
                  {metric.icon}
                </MetricIcon>
                <div className="flex-1">
                  <div className="text-white font-semibold text-lg mb-1">{metric.value}</div>
                  <div className="text-gray-400 text-xs">{metric.label}</div>
                  {metric.progress !== undefined && (
                    <div className="h-1 bg-gray-700 rounded-full overflow-hidden mt-2">
                      <div 
                        className="h-full bg-white transition-all duration-300" 
                        style={{ width: `${metric.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Activity Section - Moved to left side */}
          {data.rightSidebar?.activityChartData && (
            <ActivitySection 
              chartData={data.rightSidebar.activityChartData} 
            />
          )}
        </div>

        {/* Right Sidebar - Cards */}
        {data.rightSidebar && (
          <div className="col-span-4 flex flex-col gap-4">
            {/* NFT Card */}
            <div className="rounded-xl bg-gray-800 p-4">
              <div className="w-full h-32 bg-gray-700 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {data.rightSidebar.nftImage || (
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Badge variant="gray" className="flex items-center gap-1 text-xs">
                  Nft
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Badge>
                <Badge variant="gray" className="flex items-center gap-1 text-xs">
                  Portfolio
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Badge>
              </div>
            </div>

            {/* Circular Progress Chart */}
            <div className="rounded-xl bg-gray-800 p-4 flex flex-col items-center">
              <CircularProgress 
                value={data.rightSidebar.progressValue || 60} 
                label={data.rightSidebar.progressLabel || "WETH/USDC"}
                size={100}
              />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
