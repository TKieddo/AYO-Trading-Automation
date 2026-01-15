"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { Position } from "@/lib/types";
import { ChartSection } from "@/components/charts/organisms/ChartSection";
import { TradingCard } from "@/components/charts/organisms/TradingCard";
import { OrderPlacement } from "@/components/charts/organisms/OrderPlacement";
import { OrderDetails } from "@/components/charts/organisms/OrderDetails";
import { AssetCard } from "@/components/charts/molecules/AssetCard";
import { TradingTable } from "@/components/charts/organisms/TradingTable";
import { ChartFilters } from "@/components/charts/molecules/ChartFilters";

// Generate sample line chart data based on timeframe with price crossing entry
function generateLineData(timeframe: "5m" | "1h" | "8h" | "1D" | "1W" = "8h", entryPrice: number = 95000, useStablePrice: boolean = false) {
  const data = [];
  const now = new Date();
  const basePrice = 97417.05;
  let currentPrice = basePrice;
  
  // If stable mode, use deterministic values (for SSR)
  if (useStablePrice) {
    // Return deterministic data for SSR to avoid hydration mismatches
    for (let i = 179; i >= 0; i--) {
      const time = new Date(now);
      time.setMinutes(time.getMinutes() - (i * 480)); // 8h intervals
      
      const progress = (179 - i) / 179;
      const patternPrice = basePrice * (1 + (progress * 0.02 - 0.01)); // Small deterministic variation
      currentPrice = patternPrice;
      
      const month = time.toLocaleDateString('en-US', { month: 'short' });
      const day = time.getDate();
      const hours = time.getHours().toString().padStart(2, '0');
      const timeStr = `${month} ${day}, ${hours}:00`;
      
      data.push({
        time: timeStr,
        value: currentPrice,
        timestamp: time.getTime(),
      });
    }
    return data;
  }

  // Determine number of data points and interval based on timeframe
  let numPoints: number;
  let intervalMinutes: number;
  
  switch (timeframe) {
    case "5m":
      numPoints = 200; // More points for smoother panning
      intervalMinutes = 5;
      break;
    case "1h":
      numPoints = 168; // 1 week of hourly data
      intervalMinutes = 60;
      break;
    case "8h":
      numPoints = 180; // 60 days of 8-hour intervals
      intervalMinutes = 480;
      break;
    case "1D":
      numPoints = 180; // 6 months
      intervalMinutes = 1440;
      break;
    case "1W":
      numPoints = 104; // 2 years
      intervalMinutes = 10080;
      break;
    default:
      numPoints = 180;
      intervalMinutes = 480;
  }

  // Create a price pattern that crosses entry price multiple times
  // Start above entry, dip below, recover above, dip below again
  for (let i = numPoints - 1; i >= 0; i--) {
    const time = new Date(now);
    time.setMinutes(time.getMinutes() - (i * intervalMinutes));
    
    // Create a pattern that crosses entry price
    const progress = (numPoints - 1 - i) / (numPoints - 1);
    
    // Pattern: Start at 98k, dip to 92k (below entry), rise to 100k, dip to 94k, end at 97k
    const patternPrice = 
      progress < 0.2 ? 
        basePrice * 1.01 - (basePrice * 0.06 * (progress / 0.2)) : // Start high, dip below entry
      progress < 0.4 ?
        entryPrice * 0.97 + (basePrice * 1.03 - entryPrice * 0.97) * ((progress - 0.2) / 0.2) : // Rise above entry
      progress < 0.6 ?
        basePrice * 1.03 - (basePrice * 0.04 * ((progress - 0.4) / 0.2)) : // Dip slightly below entry again
      progress < 0.8 ?
        entryPrice * 0.98 + (basePrice * 0.99 - entryPrice * 0.98) * ((progress - 0.6) / 0.2) : // Rise above entry
      basePrice * 0.99 + (basePrice * 1.002 - basePrice * 0.99) * ((progress - 0.8) / 0.2); // End slightly above
    
    // Add realistic volatility
    const volatility = basePrice * 0.005; // 0.5% volatility
    const noise = (Math.random() - 0.5) * volatility * 0.5;
    currentPrice = Math.max(basePrice * 0.85, Math.min(basePrice * 1.15, patternPrice + noise));

    let timeStr: string;
    if (timeframe === "5m" || timeframe === "1h") {
      const hours = time.getHours().toString().padStart(2, '0');
      const minutes = time.getMinutes().toString().padStart(2, '0');
      timeStr = `${hours}:${minutes}`;
    } else if (timeframe === "8h") {
      const month = time.toLocaleDateString('en-US', { month: 'short' });
      const day = time.getDate();
      const hours = time.getHours().toString().padStart(2, '0');
      timeStr = `${month} ${day}, ${hours}:00`;
    } else if (timeframe === "1D") {
      const month = time.toLocaleDateString('en-US', { month: 'short' });
      const day = time.getDate();
      timeStr = `${month} ${day}`;
    } else {
      // 1W
      const month = time.toLocaleDateString('en-US', { month: 'short' });
      const day = time.getDate();
      timeStr = `${month} ${day}`;
    }

    data.push({
      time: timeStr,
      value: currentPrice,
      timestamp: time.getTime(), // Add timestamp for proper time-based calculations
    });
  }

  return data;
}

const assetCards = [
  { symbol: "ETH/USD", price: 3865.12, changePercent: 1.39, icon: "https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop" },
  { symbol: "SOL/USD", price: 162.4, changePercent: 4.33, icon: "https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop" },
  { symbol: "MATIC/USD", price: 0.85, changePercent: -2.15, icon: "https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop" },
  { symbol: "BNB/USD", price: 585.42, changePercent: 0.92, icon: "https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop" },
];

export default function ChartsPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<"5m" | "1h" | "8h" | "1D" | "1W">("8h");
  const entryPrice = 95000; // Entry price for the trade
  const [amount, setAmount] = useState("5.500");
  const [activeTab, setActiveTab] = useState<"LONG" | "SHORT">("LONG");
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Generate full dataset (will be used by chart for panning)
  // Use stable data for SSR to avoid hydration mismatches
  const fullLineData = useMemo(() => {
    // Use stable price generation for SSR, random after mount
    return generateLineData(selectedTimeframe, entryPrice, !isMounted);
  }, [selectedTimeframe, entryPrice, isMounted]);
  
  // Current price is the last data point
  const currentPrice = fullLineData.length > 0 
    ? fullLineData[fullLineData.length - 1].value 
    : 97417.05;
  const change = currentPrice - entryPrice;
  const changePercent = (change / entryPrice) * 100;
  
  // Set mounted flag after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch positions to show in the Amount card
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await fetch("/api/positions");
        if (response.ok) {
          const data = await response.json();
          setPositions(data || []);
        }
      } catch (error) {
        console.error("Failed to fetch positions:", error);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 3000); // Update every 3s
    return () => clearInterval(interval);
  }, []);

  // Auto-select first position based on active tab when tab changes
  useEffect(() => {
    if (positions.length > 0) {
      const filteredPositions = activeTab === "LONG" 
        ? positions.filter((pos) => pos.side === "long")
        : positions.filter((pos) => pos.side === "short");
      
      // If current selected position doesn't match active tab, or no position selected
      const shouldReselect = !selectedPosition || 
        (activeTab === "LONG" && selectedPosition.side !== "long") ||
        (activeTab === "SHORT" && selectedPosition.side !== "short");
      
      if (shouldReselect && filteredPositions.length > 0) {
        setSelectedPosition(filteredPositions[0]);
      } else if (filteredPositions.length === 0) {
        setSelectedPosition(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, activeTab]);

  // Get unique symbols from positions for filter dropdown
  const availableSymbols = useMemo(() => {
    const symbolsSet = new Set<string>();
    positions.forEach((pos) => {
      if (pos.symbol) {
        symbolsSet.add(pos.symbol);
      }
    });
    return Array.from(symbolsSet).sort();
  }, [positions]);

  return (
    <div className="relative min-h-screen">
      {/* Gradient Background - scattered across whole page with #8c4efd and brand green/yellow */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
        <div className="h-full w-full bg-[radial-gradient(800px_600px_at_5%_5%,rgba(140,78,253,0.22)_0%,rgba(254,249,195,0.08)_20%,transparent_50%),radial-gradient(700px_500px_at_95%_10%,rgba(140,78,253,0.18)_0%,rgba(236,252,203,0.06)_20%,transparent_50%),radial-gradient(750px_550px_at_10%_90%,rgba(140,78,253,0.22)_0%,rgba(254,249,195,0.08)_20%,transparent_50%),radial-gradient(650px_450px_at_90%_95%,rgba(140,78,253,0.18)_0%,rgba(236,252,203,0.06)_20%,transparent_50%),radial-gradient(900px_600px_at_50%_50%,rgba(140,78,253,0.25)_0%,rgba(255,247,179,0.1)_25%,transparent_55%),radial-gradient(600px_400px_at_30%_20%,rgba(140,78,253,0.15)_0%,rgba(254,249,195,0.06)_20%,transparent_45%),radial-gradient(550px_350px_at_70%_80%,rgba(140,78,253,0.15)_0%,rgba(236,252,203,0.05)_20%,transparent_45%)]" />
      </div>

      {/* Header ref for scroll detection */}
      <div ref={headerRef} className="h-0" />

      {/* Sticky Filters */}
      <ChartFilters
        headerRef={headerRef}
        symbols={availableSymbols}
        activeTab={activeTab}
        selectedTimeframe={selectedTimeframe}
        onTimeframeChange={setSelectedTimeframe}
        onTabChange={setActiveTab}
      />

      <div className="space-y-4">
        {/* Main Chart and Trading Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Column: Chart and Asset Cards */}
          <div className="lg:col-span-3 space-y-4">
            {/* Chart Area with integrated header */}
            <ChartSection
              symbol={selectedPosition?.symbol || "BTC/USDT"}
              price={selectedPosition?.currentPrice || currentPrice}
              changePercent={changePercent}
              availablePairs={assetCards.map(a => a.symbol)}
              selectedTimeframe={selectedTimeframe}
              onTimeframeChange={setSelectedTimeframe}
              entryPrice={selectedPosition?.entryPrice || entryPrice}
              positions={positions}
              selectedPosition={selectedPosition}
              activeTab={activeTab}
              onPairChange={(pair) => {
                // Handle pair change - update chart data for selected pair
                console.log('Pair changed to:', pair);
              }}
            />

            {/* Asset Cards - Below chart, same width, all in one row */}
            <div className="grid grid-cols-4 gap-2">
              {assetCards.map((asset) => (
                <AssetCard
                  key={asset.symbol}
                  symbol={asset.symbol}
                  price={asset.price}
                  changePercent={asset.changePercent}
                  icon={asset.icon}
                />
              ))}
            </div>
          </div>

          {/* Right Column: Trading Cards - Stacked vertically */}
          <div className="lg:col-span-1 space-y-2.5">
            {/* Long/Short Toggle - Above trading cards */}
            <div className="flex bg-white rounded-2xl shadow-sm border border-black/5 p-0.5 gap-0">
              <button
                onClick={() => setActiveTab("LONG")}
                className={`flex-1 py-1 text-[10px] font-semibold transition-all uppercase ${
                  activeTab === "LONG"
                    ? "bg-[#1A1A1A] text-white rounded-xl"
                    : "bg-white/10 text-[#1A1A1A] rounded-l-xl rounded-r-none"
                }`}
              >
                LONG
              </button>
              <button
                onClick={() => setActiveTab("SHORT")}
                className={`flex-1 py-1 text-[10px] font-semibold transition-all uppercase ${
                  activeTab === "SHORT"
                    ? "bg-[#1A1A1A] text-white rounded-xl"
                    : "bg-white/10 text-[#1A1A1A] rounded-r-xl rounded-l-none"
                }`}
              >
                SHORT
              </button>
            </div>
            
            <TradingCard 
              type="amount" 
              currentPrice={currentPrice} 
              onAmountChange={setAmount} 
              activeTab={activeTab === "LONG" ? "BUY" : "SELL"} 
              onTabChange={(tab) => setActiveTab(tab === "BUY" ? "LONG" : "SHORT")}
              selectedPosition={selectedPosition}
            />
            <TradingCard type="leverage" selectedPosition={selectedPosition} />
            <TradingCard type="stopLoss" selectedPosition={selectedPosition} />
            <TradingCard type="takeProfit" selectedPosition={selectedPosition} />
            <OrderPlacement 
              currentPrice={currentPrice} 
              amount={amount} 
              activeTab={activeTab === "LONG" ? "BUY" : "SELL"}
              selectedPosition={selectedPosition}
            />
            <OrderDetails 
              selectedPosition={selectedPosition}
            />
          </div>
        </div>

        {/* Trading Table - Full width below all sections */}
        <TradingTable 
          activeTab={activeTab} 
          onPositionSelect={setSelectedPosition}
          selectedPositionId={selectedPosition?.id || null}
        />
      </div>
    </div>
  );
}
