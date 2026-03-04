"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

import type { Position } from "@/lib/types";

type TradingCardProps = {
  type: "amount" | "leverage" | "stopLoss" | "takeProfit";
  currentPrice?: number;
  onAmountChange?: (amount: string) => void;
  activeTab?: "BUY" | "SELL";
  onTabChange?: (tab: "BUY" | "SELL") => void;
  selectedPosition?: Position | null;
};

export function TradingCard({ type, currentPrice = 97417.05, onAmountChange, activeTab: externalActiveTab, onTabChange, selectedPosition }: TradingCardProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<"BUY" | "SELL">("BUY");
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  
  const handleTabChange = (tab: "BUY" | "SELL") => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };
  const [amount, setAmount] = useState("5.500");

  const handleAmountChange = (newAmount: string) => {
    setAmount(newAmount);
    onAmountChange?.(newAmount);
  };
  const [leverage, setLeverage] = useState(50);
  const [stopLoss, setStopLoss] = useState("0");
  const [takeProfit, setTakeProfit] = useState("900");

  const amountQuickValues = ["1.00", "2.00", "5.00", "10.00", "15.00"];
  const stopLossValues = ["0%", "-10%", "-25%", "-50%", "-75%"];
  const takeProfitValues = ["25%", "50%", "100%", "300%", "900%"];

  // Sync leverage with selected position
  useEffect(() => {
    if (selectedPosition?.leverage !== undefined) {
      setLeverage(selectedPosition.leverage);
    }
  }, [selectedPosition]);

  // Sync stop loss with selected position
  useEffect(() => {
    if (!selectedPosition || !selectedPosition.entryPrice) return;

    // Prefer exchange-confirmed SL from open reduce-only STOP orders.
    if (selectedPosition.slPrice && selectedPosition.slPrice > 0) {
      setStopLoss(selectedPosition.slPrice.toFixed(2));
      return;
    }

    if (selectedPosition.liquidationPrice) {
      // Calculate stop loss percentage from entry to liquidation
      const percentFromEntry = ((selectedPosition.liquidationPrice - selectedPosition.entryPrice) / selectedPosition.entryPrice) * 100;
      
      // Find matching button value
      const matchingValue = stopLossValues.find(val => {
        const valNum = Math.abs(parseFloat(val.replace("%", "")));
        const calcNum = Math.abs(percentFromEntry);
        // Match if within 5% range
        return Math.abs(valNum - calcNum) < 5 || (val === "0%" && calcNum < 5);
      });
      
      if (matchingValue) {
        setStopLoss(matchingValue === "0%" ? "0" : matchingValue);
      } else {
        // Set the calculated price value
        setStopLoss(selectedPosition.liquidationPrice.toFixed(2));
      }
    }
  }, [selectedPosition]);

  // Sync take profit with selected position
  useEffect(() => {
    if (!selectedPosition || !selectedPosition.entryPrice) return;

    // Prefer exchange-confirmed TP from open reduce-only TP orders.
    if (selectedPosition.tpPrice && selectedPosition.tpPrice > 0) {
      setTakeProfit(selectedPosition.tpPrice.toFixed(2));
      return;
    }

    if (selectedPosition.currentPrice) {
      // Calculate current profit percentage
      const profitPercent = ((selectedPosition.currentPrice - selectedPosition.entryPrice) / selectedPosition.entryPrice) * 100;
      
      // Find matching button value
      const matchingValue = takeProfitValues.find(val => {
        const valNum = parseFloat(val.replace("%", ""));
        // Match if within 10% range
        return Math.abs(valNum - profitPercent) < 10;
      });
      
      if (matchingValue) {
        setTakeProfit(matchingValue.replace("%", ""));
      } else if (profitPercent > 0) {
        // Show actual percentage if no match and positive
        setTakeProfit(profitPercent.toFixed(2));
      }
    }
  }, [selectedPosition]);

  const riskLevel = leverage <= 25 ? "Low Risk" : leverage <= 50 ? "Medium Risk" : "High Risk";
  const riskColor = leverage <= 25 ? "bg-[#ECFCCB] text-[#4CAF50]" : leverage <= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

  // Custom slider styles
  const sliderStyles = `
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #1A1A1A;
      border: 3px solid white;
      cursor: pointer;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
    }
    input[type="range"]::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #1A1A1A;
      border: 3px solid white;
      cursor: pointer;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
    }
  `;

  if (type === "amount") {
    // Calculate values from selected position
    const positionValue = selectedPosition 
      ? (selectedPosition.size || 0) * (selectedPosition.currentPrice || 0)
      : 0;
    const entryValue = selectedPosition
      ? (selectedPosition.size || 0) * (selectedPosition.entryPrice || 0)
      : 0;
    const positionSize = selectedPosition ? (selectedPosition.size || 0) : 0;
    const positionSymbol = selectedPosition ? (selectedPosition.symbol || "N/A") : "N/A";

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: sliderStyles }} />
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-2.5 overflow-hidden">
          {/* Trade Info Section */}
          <div className="min-w-0">
            <label className="block text-[10px] font-medium text-[#1A1A1A] mb-2 truncate">
              {selectedPosition ? `Selected Trade - ${positionSymbol}` : "No Trade Selected"}
            </label>
            
            {/* USD Value with Coin Symbol */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-[#666]">USD Value</span>
                <div className="flex items-center gap-0.5 px-2 py-0.5 bg-[#F5F5F5] rounded shrink-0">
                  <span className="text-[9px] font-medium text-[#1A1A1A] whitespace-nowrap">
                    {selectedPosition?.symbol?.split('/')[0] || "USD"}
                  </span>
                </div>
              </div>
              <div className="text-base font-bold text-[#1A1A1A] mb-1">
                {selectedPosition 
                  ? `$${positionValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "$0.00"}
              </div>
              {/* Coin Amount below USD */}
              {selectedPosition && positionSize > 0 && (
                <div className="text-sm font-medium text-[#666]">
                  {positionSize.toLocaleString('en-US', { 
                    minimumFractionDigits: 4, 
                    maximumFractionDigits: 8 
                  })} {selectedPosition.symbol?.split('/')[0] || ""}
                </div>
              )}
            </div>

            {/* Additional Info */}
            {selectedPosition && (
              <div className="mt-2.5 pt-2.5 border-t border-[#E0E0E0]">
                <div className="flex items-center justify-between text-[9px] text-[#666]">
                  <span>Entry Value</span>
                  <span className="font-medium text-[#1A1A1A]">
                    ${entryValue.toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-[#666] mt-1">
                  <span>Entry Price</span>
                  <span className="font-medium text-[#1A1A1A]">
                    ${(selectedPosition.entryPrice || 0).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-[#666] mt-1">
                  <span>Current Price</span>
                  <span className="font-medium text-[#1A1A1A]">
                    ${(selectedPosition.currentPrice || 0).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-[#666] mt-1">
                  <span>PnL</span>
                  <span className={`font-medium ${
                    (selectedPosition.unrealizedPnl || 0) >= 0 
                      ? "text-green-600" 
                      : "text-red-600"
                  }`}>
                    ${(selectedPosition.unrealizedPnl || 0).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  if (type === "leverage") {
    // Use synced leverage state (updated by useEffect when position changes)
    const displayLeverage = leverage;
    const displayRiskLevel = displayLeverage <= 25 ? "Low Risk" : displayLeverage <= 50 ? "Medium Risk" : "High Risk";
    const displayRiskColor = displayLeverage <= 25 ? "bg-[#ECFCCB] text-[#4CAF50]" : displayLeverage <= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
    
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: sliderStyles }} />
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-2.5 overflow-hidden">
          <div className="flex items-center justify-between mb-1 min-w-0">
            <label className="block text-[10px] font-medium text-[#1A1A1A] truncate">Leverage Used</label>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 ${displayRiskColor}`}>
              {displayRiskLevel}
            </span>
          </div>
          <div className="text-lg font-bold text-[#1A1A1A] mb-2 truncate">{displayLeverage}x</div>
          <div className="relative w-full">
            <input
              type="range"
              min="0"
              max="100"
              value={displayLeverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full h-1.5 bg-[#E0E0E0] rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #1A1A1A 0%, #1A1A1A ${displayLeverage}%, #E0E0E0 ${displayLeverage}%, #E0E0E0 100%)`,
              }}
            />
            <div className="flex justify-between mt-1 text-[9px] text-[#AAAAAA]">
              <span className="whitespace-nowrap">0</span>
              <span className="whitespace-nowrap">25</span>
              <span className="whitespace-nowrap">50</span>
              <span className="whitespace-nowrap">75</span>
              <span className="whitespace-nowrap">100</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (type === "stopLoss") {
    // Use synced stop loss state (updated by useEffect when position changes)
    const coinSymbol = selectedPosition?.symbol?.split('/')[0] || "USDT";
    const displayStopLossPercent = stopLoss;
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-2.5 overflow-hidden">
        <label className="block text-[10px] font-medium text-[#1A1A1A] mb-1 truncate">Stop Loss</label>
        <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
          <input
            type="text"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            className="flex-1 min-w-0 text-base font-bold text-[#1A1A1A] bg-transparent border-none outline-none"
          />
          <div className="flex items-center gap-0.5 px-2 py-1 bg-[#F5F5F5] rounded-lg cursor-pointer hover:bg-[#E8E8E8] shrink-0">
            <span className="text-[10px] font-medium text-[#1A1A1A] whitespace-nowrap">{coinSymbol}</span>
            <ChevronDown className="w-3 h-3 text-[#1A1A1A] shrink-0" />
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {stopLossValues.map((val) => (
            <button
              key={val}
              onClick={() => setStopLoss(val === "0%" ? "0" : val)}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap shrink-0 ${
                displayStopLossPercent === (val === "0%" ? "0" : val)
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white border border-[#E0E0E0] text-[#1A1A1A] hover:border-[#1A1A1A]"
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (type === "takeProfit") {
    // Use synced take profit state (updated by useEffect when position changes)
    const displayTakeProfit = takeProfit;
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-2.5 overflow-hidden">
        <label className="block text-[10px] font-medium text-[#1A1A1A] mb-1 truncate">Take Profit</label>
        <div className="text-lg font-bold text-[#1A1A1A] mb-1.5 truncate">{displayTakeProfit}%</div>
        <div className="flex gap-1 flex-wrap">
          {takeProfitValues.map((val) => (
            <button
              key={val}
              onClick={() => setTakeProfit(val.replace("%", ""))}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap shrink-0 ${
                displayTakeProfit === val.replace("%", "")
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white border border-[#E0E0E0] text-[#1A1A1A] hover:border-[#1A1A1A]"
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

