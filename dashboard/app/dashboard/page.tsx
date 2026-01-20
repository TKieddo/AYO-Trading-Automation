import { AccountMetrics } from "@/components/dashboard/AccountMetrics";
import { PositionsTable } from "@/components/dashboard/PositionsTable";
import { OrdersTable } from "@/components/dashboard/OrdersTable";
import { TradingLogs } from "@/components/dashboard/TradingLogs";
import { DecisionsFeed } from "@/components/dashboard/DecisionsFeed";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { PnLChart } from "@/components/dashboard/PnLChart";
import { TradingControls } from "@/components/dashboard/TradingControls";
import { AssetManager } from "@/components/dashboard/AssetManager";
import { OverviewStats } from "@/components/dashboard/OverviewStats";
import { CardTitle } from "@/components/ui/card";
import { OpenPositionsCompact } from "@/components/dashboard/OpenPositionsCompact";
import { AiChat } from "@/components/ai/AiChat";
import { ScrollTop } from "@/components/layout/ScrollTop";

export default function DashboardPage() {
  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Hero Section: Left PnL chart, Right Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-[24px] bg-white ring-1 ring-black/5 p-4">
          <CardTitle className="mb-2 text-slate-700">PNL per day</CardTitle>
          <PnLChart />
        </div>
        <div className="lg:col-span-1" id="decisions">
          <DecisionsFeed variant="dashboard" />
        </div>
      </div>

      {/* Overview cards + Performance chart on the same row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OverviewStats />
          <OpenPositionsCompact />
        </div>
        <div className="lg:col-span-1 rounded-[24px] bg-white ring-1 ring-black/5 p-4 w-full">
          <PerformanceChart />
        </div>
      </div>

      {/* Asset Manager */}
      <AssetManager />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Controls */}
        <div className="lg:col-span-1">
          <TradingControls />
        </div>

        {/* Positions */}
        <div className="lg:col-span-2">
          <PositionsTable />
        </div>
      </div>

      {/* AI Chat - placed above Recent Orders */}
      <div className="my-20 lg:my-32">
        <AiChat />
      </div>

      {/* Recent Orders */}
      <div id="orders">
        <OrdersTable />
      </div>

      {/* Logs */}
      <div id="logs">
        <TradingLogs />
      </div>
      <ScrollTop />
    </div>
  );
}
