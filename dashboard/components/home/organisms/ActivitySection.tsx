"use client";

import { useState } from "react";
import { ToggleButtons } from "../molecules/ToggleButtons";
import { BarChart } from "../molecules/BarChart";
import { ActivityNotificationCard } from "../molecules/ActivityNotificationCard";

interface ActivitySectionProps {
  chartData?: {
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
}

export function ActivitySection({ 
  chartData = {
    data: [45, 60, 55, 70, 65],
    labels: ["0.1", "0.2", "0.3", "0.4", "0.5"],
    maxValue: "$ 8.900",
    title: "At a Galence"
  },
  notifications = []
}: ActivitySectionProps) {
  const [selectedTab, setSelectedTab] = useState<"Investors" | "Trading">("Investors");

  return (
    <div className="rounded-2xl bg-gray-900 p-6">
      <h2 className="text-white text-lg font-semibold mb-4">Activity valiue over time</h2>
      
      <ToggleButtons
        options={["Investors", "Trading"]}
        selected={selectedTab}
        onSelect={setSelectedTab}
      />

      <div className="mb-4 mt-6">
        <BarChart
          data={chartData.data}
          labels={chartData.labels}
          maxValue={chartData.maxValue}
          title={chartData.title}
        />
      </div>
    </div>
  );
}
