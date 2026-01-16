import { MetricIcon } from "../atoms/MetricIcon";
import { ReactNode } from "react";

interface PerformanceMetricProps {
  icon: ReactNode;
  iconVariant?: "yellow" | "white";
  value: string;
  label: string;
  progress?: number; // 0-100 for progress bar
}

export function PerformanceMetric({ 
  icon, 
  iconVariant = "white", 
  value, 
  label,
  progress 
}: PerformanceMetricProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="mb-3">
        <MetricIcon variant={iconVariant}>
          {icon}
        </MetricIcon>
      </div>
      <div className="text-white font-semibold text-lg mb-1">{value}</div>
      <div className="text-gray-400 text-xs mb-2">{label}</div>
      {progress !== undefined && (
        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white transition-all duration-300" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
}
