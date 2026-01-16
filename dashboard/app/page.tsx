"use client";

import { HomeTemplate } from "@/components/home/templates/HomeTemplate";

export default function HomePage() {
  // Performance data
  const performanceData = {
    total: "12,7898.00",
    period: "Past Week",
    change: "0.004567%",
    metrics: [
      {
        icon: <span className="text-black font-bold text-lg">$</span>,
        iconVariant: "yellow" as const,
        value: "$ 15.000",
        label: "Ballance"
      },
      {
        icon: <span className="text-black font-bold">A</span>,
        iconVariant: "white" as const,
        value: "$ 7.300",
        label: "Leverage"
      },
      {
        icon: (
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        iconVariant: "white" as const,
        value: "$ 211.200",
        label: "Margin Usage",
        progress: 75
      }
    ]
  };

  // Markets data
  const marketsData = [
    {
      pair: ["Origin", "SNX"],
      changePercent: "0.0067%",
      value: "USD 00,160.10",
      sliderValue: 33,
      price: "$ 1.02"
    },
    {
      pair: ["Tether", "XRP"],
      changePercent: "0.4567%",
      value: "USD 13,160.10",
      sliderValue: 67,
      price: "$ 2.50"
    },
    {
      pair: ["Tether", "XRP"],
      changePercent: "0.4567%",
      value: "USD 52,160.10",
      sliderValue: 80,
      price: "$ 3.75"
    },
    {
      pair: ["Ethereum", "ETH"],
      changePercent: "0.4567%",
      value: "USD 00,001.10",
      sliderValue: 20,
      price: "$ 0.50"
    }
  ];

  // Right column data
  const rightColumnData = {
    progressValue: 60,
    progressLabel: "WETH/USDC",
    activityChartData: {
      data: [45, 60, 55, 70, 65],
      labels: ["0.1", "0.2", "0.3", "0.4", "0.5"],
      maxValue: "$ 8.900",
      title: "At a Galence"
    },
    notifications: [
      {
        icon: (
          <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        ),
        date: "02 FEB",
        avatar: (
          <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        ),
        title: "Video Cal to Jessica Jesper",
        variant: "default" as const
      },
      {
        icon: (
          <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        ),
        date: "05 FEB",
        avatar: (
          <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        ),
        title: "Send payment reminder",
        amount: "$5,789",
        variant: "payment" as const
      }
    ]
  };

  return (
    <HomeTemplate
      performanceData={performanceData}
      marketsData={marketsData}
      rightColumnData={rightColumnData}
    />
  );
}
