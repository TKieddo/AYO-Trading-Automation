"use client";

import dynamic from "next/dynamic";
import { ScrollTop } from "@/components/layout/ScrollTop";
import { PnLChart } from "@/components/dashboard/PnLChart";
import { CardTitle } from "@/components/ui/card";
import { useHistoryState } from "@/components/history/hooks/useHistoryState";
import { TopFilters, StickyFilters } from "@/components/history/molecules/HistoryFilters";
import { KpiRow } from "@/components/history/organisms/KpiRow";
import { DistributionCard } from "@/components/history/organisms/DistributionCard";
import { PairStatsGrid } from "@/components/history/organisms/PairStatsGrid";

const TradesTable = dynamic(() => import("@/components/history/organisms/TradesTable").then(m => m.TradesTable), { ssr: false });
const WinsLosses = dynamic(() => import("@/components/history/organisms/WinsLosses").then(m => m.WinsLosses), { ssr: false });
const OrderMetricsAndFees = dynamic(() => import("@/components/history/organisms/OrderMetricsAndFees").then(m => m.OrderMetricsAndFees), { ssr: false });
const OrdersTable = dynamic(() => import("@/components/history/organisms/OrdersTable").then(m => m.OrdersTable), { ssr: false });

export default function HistoryPage() {
  const {
    range,
    filterSide,
    filterSymbol,
    filterStatus,
    filterType,
    filtersStuck,
    sideOpen,
    headerRef,
    setRange,
    setFilterSide,
    setFilterSymbol,
    setFilterStatus,
    setFilterType,
    setSideOpen,
    symbols,
    filteredTrades,
    filteredOrders,
    winsAndLosses,
    aggregate,
    distribution,
    byPair,
    orderMetrics,
    feesAndProfit,
  } = useHistoryState();

  const exportCsv = (kind: "trades" | "orders") => {
    const rows = kind === "trades" ? filteredTrades : filteredOrders;
    const headers = kind === "trades"
      ? ["id", "time", "symbol", "side", "size", "price", "fee", "pnl"]
      : ["id", "time", "symbol", "side", "type", "size", "price", "status"];
    const escape = (v: any) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = [
      headers.join(","),
      ...(kind === "trades"
        ? rows.map(r => [
            (r as any).id,
            (r as any).timestamp,
            (r as any).symbol,
            (r as any).side,
            (r as any).size,
            (r as any).price,
            (r as any).fee,
            (r as any).pnl,
          ].map(escape).join(","))
        : rows.map(r => [
            (r as any).id,
            (r as any).createdAt,
            (r as any).symbol,
            (r as any).side,
            (r as any).type,
            (r as any).size,
            ((r as any).price ?? ""),
            (r as any).status,
          ].map(escape).join(","))
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind + "_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <TopFilters
        range={range}
        setRange={setRange}
        filterSide={filterSide}
        setFilterSide={setFilterSide}
        filterSymbol={filterSymbol}
        setFilterSymbol={setFilterSymbol}
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        symbols={symbols}
        onExport={exportCsv}
        headerRef={headerRef}
      />

      <KpiRow aggregate={aggregate} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-[24px] bg-white ring-1 ring-black/5 p-4">
          <CardTitle className="mb-2 text-slate-700">PNL per day</CardTitle>
          <PnLChart />
        </div>
        <DistributionCard distribution={distribution as any} />
      </div>

      <PairStatsGrid byPair={byPair as any} />

      <TradesTable rows={filteredTrades as any} />

      <WinsLosses winsAndLosses={winsAndLosses as any} />

      <OrderMetricsAndFees orderMetrics={orderMetrics as any} feesAndProfit={feesAndProfit as any} />

      <StickyFilters
        visible={filtersStuck}
        sideOpen={sideOpen}
        setSideOpen={setSideOpen}
        range={range}
        setRange={setRange}
        filterSide={filterSide}
        setFilterSide={setFilterSide}
        filterSymbol={filterSymbol}
        setFilterSymbol={setFilterSymbol}
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        symbols={symbols}
        onExport={exportCsv}
      />

      <OrdersTable rows={filteredOrders as any} />

      <ScrollTop />
    </div>
  );
}


