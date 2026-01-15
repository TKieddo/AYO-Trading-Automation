"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { PriceData } from "@/lib/types";

interface PriceTickerProps {
  initialPrices?: PriceData[];
}

export function PriceTicker({ initialPrices = [] }: PriceTickerProps) {
  const [prices, setPrices] = useState<PriceData[]>(initialPrices);
  const [assets, setAssets] = useState<string[]>([]);

  useEffect(() => {
    // Fetch tracked assets
    const fetchAssets = async () => {
      try {
        const res = await fetch("/api/assets", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.assets) && data.assets.length > 0) {
            setAssets(data.assets);
          }
        }
      } catch (e) {
        console.error("Failed to fetch assets:", e);
      }
    };

    // Fetch initial prices
    const fetchPrices = async () => {
      try {
        const response = await fetch("/api/prices");
        if (response.ok) {
          const data = await response.json();
          setPrices(data);
        }
      } catch (error) {
        console.error("Failed to fetch prices:", error);
      }
    };

    fetchAssets();
    fetchPrices();

    // Update prices every 5 seconds
    const interval = setInterval(fetchPrices, 5000);

    return () => clearInterval(interval);
  }, []);

  // Get premium color scheme for each asset
  const getAssetColor = (asset: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; symbol: string }> = {
      BTC: { bg: "from-orange-400/30 via-orange-300/25 to-yellow-400/20", text: "text-orange-700", border: "border-orange-300/40", symbol: "text-orange-600" },
      ETH: { bg: "from-blue-400/30 via-indigo-300/25 to-purple-400/20", text: "text-blue-700", border: "border-blue-300/40", symbol: "text-blue-600" },
      SOL: { bg: "from-purple-400/30 via-pink-300/25 to-violet-400/20", text: "text-purple-700", border: "border-purple-300/40", symbol: "text-purple-600" },
      BNB: { bg: "from-yellow-400/30 via-amber-300/25 to-orange-400/20", text: "text-yellow-700", border: "border-yellow-300/40", symbol: "text-yellow-600" },
      DOGE: { bg: "from-amber-400/30 via-yellow-300/25 to-orange-400/20", text: "text-amber-700", border: "border-amber-300/40", symbol: "text-amber-600" },
      ADA: { bg: "from-emerald-400/30 via-teal-300/25 to-cyan-400/20", text: "text-emerald-700", border: "border-emerald-300/40", symbol: "text-emerald-600" },
      MATIC: { bg: "from-purple-400/30 via-pink-300/25 to-rose-400/20", text: "text-purple-700", border: "border-purple-300/40", symbol: "text-purple-600" },
      DOT: { bg: "from-pink-400/30 via-rose-300/25 to-red-400/20", text: "text-pink-700", border: "border-pink-300/40", symbol: "text-pink-600" },
      AVAX: { bg: "from-red-400/30 via-rose-300/25 to-pink-400/20", text: "text-red-700", border: "border-red-300/40", symbol: "text-red-600" },
      LINK: { bg: "from-cyan-400/30 via-blue-300/25 to-indigo-400/20", text: "text-cyan-700", border: "border-cyan-300/40", symbol: "text-cyan-600" },
    };
    return colors[asset.toUpperCase()] || { 
      bg: "from-gray-400/30 via-gray-300/25 to-slate-400/20", 
      text: "text-gray-700", 
      border: "border-gray-300/40",
      symbol: "text-gray-600"
    };
  };

  return (
    <div className="border border-[#E0E0E0] rounded-lg bg-transparent overflow-hidden">
      <div className="p-1.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5">
          {assets.map((asset) => {
            const priceData = prices.find((p) => p.symbol === asset);
            const change = priceData?.change24hPercent || 0;
            const isPositive = change >= 0;
            const colors = getAssetColor(asset);

            return (
              <div
                key={asset}
                className={`flex flex-col gap-0.5 px-1.5 py-1 rounded-md border ${colors.border} bg-gradient-to-br ${colors.bg} backdrop-blur-sm hover:shadow-md transition-all min-w-0`}
              >
                <div className={`text-[9px] font-semibold ${colors.symbol} uppercase tracking-wider truncate`}>
                  {asset}
                </div>
                <div className="text-[11px] font-bold text-[#1A1A1A] truncate">
                  {priceData
                    ? formatCurrency(priceData.price)
                    : "Loading..."}
                </div>
                <div
                  className={`flex items-center gap-0.5 text-[9px] font-semibold ${
                    isPositive
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-2 h-2" />
                  ) : (
                    <TrendingDown className="w-2 h-2" />
                  )}
                  <span className="truncate">{priceData ? formatPercent(change) : "+0.00%"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

