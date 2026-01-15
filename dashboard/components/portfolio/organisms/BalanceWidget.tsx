"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { EyeOff, Eye, TrendingUp, TrendingDown } from "lucide-react";

type BalanceWidgetProps = {
  currency: string;
  balance: string;
  availableBalance?: string; // Available balance shown below total
  delta: string;
  deltaValue?: number; // numeric value to determine color
  dayChange?: number;
  weekChange?: number;
  monthChange?: number;
};

function maskBalance(balance: string): string {
  // Replace all digits and dots with stars, keep $ and any non-digit characters
  return balance.replace(/[0-9.]/g, '*');
}

export function BalanceWidget({ currency, balance, availableBalance, delta, deltaValue, dayChange = 2.4, weekChange = 5.8, monthChange = -1.2 }: BalanceWidgetProps) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const isDeltaPositive = deltaValue !== undefined ? deltaValue >= 0 : delta.startsWith('+');
  
  const displayBalance = isBalanceVisible ? balance : maskBalance(balance);
  const displayAvailable = availableBalance ? (isBalanceVisible ? availableBalance : maskBalance(availableBalance)) : null;
  const displayDelta = isBalanceVisible ? delta : maskBalance(delta);
  
  return (
    <Card className="p-1 md:p-1.2 overflow-hidden ring-1 ring-black/10 h-full flex flex-col bg-white rounded-2xl">
      <div className="bg-[#F4FF6E] rounded-3xl px-7 md:px-8 pt-6 md:pt-7 pb-5 md:pb-6 flex flex-col items-center justify-start relative">
        <button 
          onClick={() => setIsBalanceVisible(!isBalanceVisible)}
          className="absolute top-2 right-2 h-4 w-4 text-black hover:opacity-70 transition cursor-pointer"
          aria-label={isBalanceVisible ? "Hide balance" : "Show balance"}
        >
          {isBalanceVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <div className="text-center space-y-2 w-full">
          <div className="text-black font-semibold text-xs">{currency}</div>
          <div className="text-black/80 font-normal text-[10px]">Total Wallet Balance</div>
          <div className="text-black font-extrabold text-2xl md:text-3xl leading-tight">{displayBalance}</div>
          {displayAvailable && (
            <div className="text-black/60 font-normal text-[9px]">Available: {displayAvailable}</div>
          )}
          <div className={`font-semibold text-xs ${isBalanceVisible && isDeltaPositive ? 'text-emerald-700' : isBalanceVisible ? 'text-red-600' : 'text-black'}`}>{displayDelta}</div>
        </div>
      </div>
      <div className="bg-white mt-3 pb-5">
        <div className="grid grid-cols-3 divide-x divide-slate-200">
          <PeriodMetric period="Day" change={dayChange} />
          <PeriodMetric period="Week" change={weekChange} />
          <PeriodMetric period="Month" change={monthChange} />
        </div>
      </div>
    </Card>
  );
}

function PeriodMetric({ period, change }: { period: string; change: number }) {
  const isPositive = change >= 0;
  const colorClass = isPositive ? 'text-emerald-700' : 'text-orange-500';
  const bgClass = isPositive ? 'bg-emerald-50' : 'bg-orange-50';
  
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      <div className={`inline-flex items-center justify-center gap-1 rounded-full ${bgClass} px-2.5 py-1.5`}>
        {isPositive ? (
          <TrendingUp className={`h-3.5 w-3.5 ${colorClass}`} />
        ) : (
          <TrendingDown className={`h-3.5 w-3.5 ${colorClass}`} />
        )}
        <span className={`text-xs font-semibold ${colorClass}`}>
          {isPositive ? '+' : ''}{change.toFixed(1)}%
        </span>
      </div>
      <span className="text-xs font-medium text-slate-600">{period}</span>
    </div>
  );
}



