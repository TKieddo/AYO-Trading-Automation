import { MetricIcon } from "../atoms/MetricIcon";

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
      
      <div className="relative z-10">
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

        {/* Metric List - Horizontal Table Format */}
        <div className="flex items-center gap-6">
          {data.metrics.map((metric, index) => (
            <div key={index} className="flex items-center gap-3 flex-1">
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
      </div>
    </div>
  );
}
