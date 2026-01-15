"use client";

import { useEffect, useState } from "react";
import type { Position } from "@/lib/types";

type OrderDetailsProps = {
  selectedPosition: Position | null;
};

type TradingInfo = {
  execution_price: number;
  spread: number;
  spread_percent: number;
  notional_value: number;
  estimated_slippage: number;
};

export function OrderDetails({ selectedPosition }: OrderDetailsProps) {
  const [tradingInfo, setTradingInfo] = useState<TradingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTradingInfo = async () => {
      // Only fetch if we have a selected position
      if (!selectedPosition || !selectedPosition.symbol || !selectedPosition.size || selectedPosition.size <= 0) {
        setTradingInfo(null);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        // Extract asset symbol (e.g., "BTC/USDT" -> "BTC")
        const assetSymbol = selectedPosition.symbol.split("/")[0];
        const amount = Math.abs(selectedPosition.size);
        
        const response = await fetch(
          `/api/trading-info?asset=${encodeURIComponent(assetSymbol)}&amount=${encodeURIComponent(amount)}`
        );

        if (response.ok) {
          const data = await response.json();
          setTradingInfo(data);
        } else {
          const errorData = await response.json().catch(() => ({ error: "Failed to fetch trading info" }));
          setError(errorData.error || "Failed to fetch trading info");
          setTradingInfo(null);
        }
      } catch (error) {
        console.error("Error fetching trading info:", error);
        setError("Failed to fetch trading info");
        setTradingInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTradingInfo();
    
    // Refresh every 5 seconds to keep data current
    const interval = setInterval(fetchTradingInfo, 5000);
    return () => clearInterval(interval);
  }, [selectedPosition]);

  // If no position selected, show placeholder
  if (!selectedPosition) {
    return (
      <div className="p-2.5">
        <div className="text-[10px] text-[#666] text-center py-2">
          No trade selected
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading && !tradingInfo) {
    return (
      <div className="p-2.5">
        <div className="text-[10px] text-[#666] text-center py-2">
          Loading trading info...
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !tradingInfo) {
    return (
      <div className="p-2.5">
        <div className="text-[10px] text-red-600 text-center py-2">
          {error || "Unable to fetch trading info"}
        </div>
      </div>
    );
  }

  // Only show fields we can get from API
  const orderDetails = [
    {
      label: "Execution price",
      value: `$${tradingInfo.execution_price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      label: "Spread",
      value: `${tradingInfo.spread_percent.toFixed(2)}%`,
    },
    {
      label: "Slippage",
      value: `${tradingInfo.estimated_slippage.toFixed(2)}%`,
    },
    {
      label: "Notional value",
      value: `$${tradingInfo.notional_value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
  ];

  return (
    <div className="p-2.5">
      <div className="space-y-1.5 min-w-0">
        {orderDetails.map((detail, i) => (
          <div key={i} className="flex justify-between items-center gap-2 min-w-0">
            <span className="text-[10px] text-[#1A1A1A] truncate">{detail.label}</span>
            <span className="text-[10px] font-medium text-[#1A1A1A] whitespace-nowrap shrink-0">
              {detail.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

