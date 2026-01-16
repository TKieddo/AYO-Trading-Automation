"use client";

import { useState } from "react";
import { ToggleButtons } from "../molecules/ToggleButtons";
import { BarChart } from "../molecules/BarChart";

interface ProfitLossData {
  data: number[];
  labels: string[];
  highValue: number;
  lowValue: number;
  totalProfit: number;
}

interface ActivitySectionProps {
  cryptoData?: ProfitLossData;
  forexData?: ProfitLossData;
}

export function ActivitySection({ 
  cryptoData,
  forexData
}: ActivitySectionProps) {
  const [selectedTab, setSelectedTab] = useState<"Crypto" | "Forex">("Crypto");
  
  const currentData = selectedTab === "Crypto" ? cryptoData : forexData;
  
  // Format total profit/loss
  const formatTotal = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="rounded-2xl bg-black/20 backdrop-blur-sm border border-lime-400/30 p-4">
      <h2 className="text-white text-base font-semibold mb-2">Profit & Loss Over Time</h2>
      
      <ToggleButtons
        options={["Crypto", "Forex"]}
        selected={selectedTab}
        onSelect={setSelectedTab}
      />

      {currentData && (
        <>
          <div className="mb-2 mt-3">
            <BarChart
              data={currentData.data}
              labels={currentData.labels}
              maxValue={formatTotal(currentData.totalProfit)}
              title="30 Day Performance"
              showProfitLoss={true}
              highValue={currentData.highValue}
              lowValue={currentData.lowValue}
            />
          </div>
        </>
      )}
    </div>
  );
}
