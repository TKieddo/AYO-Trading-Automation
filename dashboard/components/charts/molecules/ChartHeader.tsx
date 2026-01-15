"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { TimeframeButton } from "@/components/charts/atoms/TimeframeButton";

type Timeframe = "5m" | "1h" | "8h" | "1D" | "1W";

type ChartHeaderProps = {
  symbol: string;
  price: number;
  changePercent: number;
  availablePairs?: string[];
  onPairChange?: (pair: string) => void;
  selectedTimeframe?: Timeframe;
  onTimeframeChange?: (timeframe: Timeframe) => void;
};

export function ChartHeader({ symbol, price, changePercent, availablePairs = [], onPairChange, selectedTimeframe: externalTimeframe, onTimeframeChange }: ChartHeaderProps) {
  const [internalTimeframe, setInternalTimeframe] = useState<Timeframe>("8h");
  const [isPairDropdownOpen, setIsPairDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeframes: Timeframe[] = ["5m", "1h", "8h", "1D", "1W"];
  
  const selectedTimeframe = externalTimeframe !== undefined ? externalTimeframe : internalTimeframe;
  
  const handleTimeframeChange = (tf: Timeframe) => {
    if (onTimeframeChange) {
      onTimeframeChange(tf);
    } else {
      setInternalTimeframe(tf);
    }
  };

  const isPositive = changePercent >= 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPairDropdownOpen(false);
      }
    }
    
    if (isPairDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPairDropdownOpen]);

  return (
    <div className="flex items-center justify-between mb-4">
      {/* Left: Asset Info */}
      <div className="flex flex-col gap-1">
        {/* Pair with dropdown */}
        <div className="relative" ref={dropdownRef}>
          {availablePairs.length > 0 ? (
            <button
              onClick={() => setIsPairDropdownOpen(!isPairDropdownOpen)}
              className="flex items-center gap-1 text-xs font-medium text-[#1A1A1A] hover:text-[#1A1A1A]/80 transition-colors"
            >
              {symbol}
              <ChevronDown className={`w-3 h-3 transition-transform ${isPairDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <div className="text-xs font-medium text-[#1A1A1A]">{symbol}</div>
          )}
          {isPairDropdownOpen && availablePairs.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-black/10 z-50 min-w-[140px] max-h-48 overflow-y-auto">
              {availablePairs.map((pair) => (
                <button
                  key={pair}
                  onClick={() => {
                    onPairChange?.(pair);
                    setIsPairDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#F5F5F5] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    pair === symbol ? 'bg-[#1A1A1A] text-white hover:bg-[#2A2A2A]' : 'text-[#1A1A1A]'
                  }`}
                >
                  {pair}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Thinner, premium price text */}
          <div className="text-2xl font-light text-[#1A1A1A] tracking-tight">
            ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isPositive
                ? "bg-[#ECFCCB] text-[#4CAF50]"
                : "bg-red-100 text-red-600"
            }`}
          >
            {isPositive ? "▲" : "▼"} {Math.abs(changePercent).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Right: Timeframe Selector */}
      <div className="flex items-center gap-2">
        {/* Timeframe Selector - individual backgrounds */}
        <div className="flex items-center gap-1.5">
          {timeframes.map((tf) => (
            <TimeframeButton
              key={tf}
              timeframe={tf}
              isActive={selectedTimeframe === tf}
              onClick={() => handleTimeframeChange(tf)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

