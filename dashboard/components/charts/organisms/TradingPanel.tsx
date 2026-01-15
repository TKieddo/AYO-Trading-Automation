"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

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

type TradingPanelProps = {
  currentPrice: number;
};

export function TradingPanel({ currentPrice }: TradingPanelProps) {
  const [activeTab, setActiveTab] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("5.500");
  const [leverage, setLeverage] = useState(50);
  const [stopLoss, setStopLoss] = useState("0");
  const [takeProfit, setTakeProfit] = useState("900");

  const amountQuickValues = ["1.00", "2.00", "5.00", "10.00", "15.00"];
  const stopLossValues = ["0%", "-10%", "-25%", "-50%", "-75%"];
  const takeProfitValues = ["25%", "50%", "100%", "300%", "900%"];

  const riskLevel = leverage <= 25 ? "Low Risk" : leverage <= 50 ? "Medium Risk" : "High Risk";
  const riskColor = leverage <= 25 ? "bg-[#ECFCCB] text-[#4CAF50]" : leverage <= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

  const orderDetails = [
    { label: "Execution price", value: `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "Spread", value: "0.01%" },
    { label: "Slippage", value: "0.00%" },
    { label: "Notional value", value: `$${(parseFloat(amount) * currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "Borrow fee", value: "0.01%" },
    { label: "Daily limit", value: "Unlimited" },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: sliderStyles }} />
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-6">
      {/* BUY/SELL Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("BUY")}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
            activeTab === "BUY"
              ? "bg-[#1A1A1A] text-white"
              : "text-[#1A1A1A] hover:bg-slate-50"
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => setActiveTab("SELL")}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
            activeTab === "SELL"
              ? "bg-[#1A1A1A] text-white"
              : "text-[#1A1A1A] hover:bg-slate-50"
          }`}
        >
          SELL
        </button>
      </div>

      {/* Amount Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Amount</label>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 text-3xl font-bold text-[#1A1A1A] bg-transparent border-none outline-none"
          />
          <div className="flex items-center gap-1 px-3 py-2 bg-[#F5F5F5] rounded-lg cursor-pointer hover:bg-[#E8E8E8]">
            <span className="text-sm font-medium text-[#1A1A1A]">USDT</span>
            <ChevronDown className="w-4 h-4 text-[#1A1A1A]" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {amountQuickValues.map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                amount === val
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white border border-[#E0E0E0] text-[#CCCCCC] hover:border-[#1A1A1A] hover:text-[#1A1A1A]"
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Leverage Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-[#1A1A1A]">Leverage</label>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${riskColor}`}>
            {riskLevel}
          </span>
        </div>
        <div className="text-3xl font-bold text-[#1A1A1A] mb-4">{leverage}x</div>
        <div className="relative">
          <input
            type="range"
            min="0"
            max="100"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full h-2 bg-[#E0E0E0] rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #1A1A1A 0%, #1A1A1A ${leverage}%, #E0E0E0 ${leverage}%, #E0E0E0 100%)`,
            }}
          />
          <div className="flex justify-between mt-2 text-xs text-[#AAAAAA]">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* Stop Loss Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Stop Loss</label>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            className="flex-1 text-3xl font-bold text-[#1A1A1A] bg-transparent border-none outline-none"
          />
          <div className="flex items-center gap-1 px-3 py-2 bg-[#F5F5F5] rounded-lg cursor-pointer hover:bg-[#E8E8E8]">
            <span className="text-sm font-medium text-[#1A1A1A]">USDT</span>
            <ChevronDown className="w-4 h-4 text-[#1A1A1A]" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {stopLossValues.map((val) => (
            <button
              key={val}
              onClick={() => setStopLoss(val === "0%" ? "0" : val)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                stopLoss === (val === "0%" ? "0" : val)
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white border border-[#E0E0E0] text-[#1A1A1A] hover:border-[#1A1A1A]"
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Take Profit Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Take Profit</label>
        <div className="text-3xl font-bold text-[#1A1A1A] mb-3">{takeProfit}%</div>
        <div className="flex gap-2 flex-wrap">
          {takeProfitValues.map((val) => (
            <button
              key={val}
              onClick={() => setTakeProfit(val.replace("%", ""))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                takeProfit === val.replace("%", "")
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white border border-[#E0E0E0] text-[#1A1A1A] hover:border-[#1A1A1A]"
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Place Order Button */}
      <button
        className="w-full py-4 rounded-lg font-bold text-white bg-[#1A1A1A] hover:bg-[#2A2A2A] mb-6 transition-all"
      >
        Place {activeTab}
      </button>

      {/* Order Details */}
      <div className="space-y-3 pt-4 border-t border-[#E0E0E0]">
        {orderDetails.map((detail, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-sm text-[#1A1A1A]">{detail.label}</span>
            <span className="text-sm font-medium text-[#1A1A1A]">{detail.value}</span>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}

