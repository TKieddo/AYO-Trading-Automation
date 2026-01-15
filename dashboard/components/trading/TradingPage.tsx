"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BarChart3, Video, BookOpen, PlayCircle } from "lucide-react";
import { StrategyLearning } from "./StrategyLearning";
import { BacktestDashboard } from "./BacktestDashboard";
import { StrategyLibrary } from "./StrategyLibrary";

export function TradingPage() {
  const [activeTab, setActiveTab] = useState("backtest");

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 h-8 text-slate-700" />
          <h1 className="text-3xl font-bold text-slate-900">Trading Strategies</h1>
        </div>
        <p className="text-slate-600">
          Learn strategies from videos, backtest them, and deploy the best performers to live trading.
        </p>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="backtest" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Backtest Dashboard
          </TabsTrigger>
          <TabsTrigger value="learn" className="flex items-center gap-2">
            <Video className="w-4 h-4" />
            Learn from Video
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Strategy Library
          </TabsTrigger>
        </TabsList>

        {/* Backtest Dashboard Tab */}
        <TabsContent value="backtest" className="space-y-6">
          <BacktestDashboard />
        </TabsContent>

        {/* Strategy Learning Tab */}
        <TabsContent value="learn" className="space-y-6">
          <StrategyLearning />
        </TabsContent>

        {/* Strategy Library Tab */}
        <TabsContent value="library" className="space-y-6">
          <StrategyLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
}

