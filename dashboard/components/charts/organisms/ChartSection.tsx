"use client";

import { TradingViewChart } from "@/components/charts/organisms/TradingViewChart";
import type { Position } from "@/lib/types";

type ChartData = {
  time: string;
  value: number;
};

type Timeframe = "5m" | "1h" | "8h" | "1D" | "1W";

type ChartSectionProps = {
  symbol: string;
  price: number;
  changePercent: number;
  data?: ChartData[];
  availablePairs?: string[];
  selectedTimeframe?: Timeframe;
  onTimeframeChange?: (timeframe: Timeframe) => void;
  onPairChange?: (pair: string) => void;
  entryPrice?: number;
  positions?: Position[];
  selectedPosition?: Position | null;
  activeTab?: "LONG" | "SHORT";
};

export function ChartSection({ 
  symbol, 
  selectedTimeframe, 
  entryPrice,
  positions = [],
  selectedPosition,
  activeTab = "LONG",
}: ChartSectionProps) {
  // Use selected position symbol if available, otherwise use default symbol
  const chartSymbol = selectedPosition?.symbol || symbol;

  return (
    <div className="rounded-2xl bg-black w-full overflow-hidden relative" style={{ height: '600px' }}>
      <TradingViewChart
        symbol={chartSymbol}
        selectedTimeframe={selectedTimeframe}
        entryPrice={entryPrice}
        selectedPosition={selectedPosition}
        positions={positions}
        activeTab={activeTab}
        height={600}
      />
    </div>
  );
}

