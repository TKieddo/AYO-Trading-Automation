"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, Activity, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { AccountMetrics } from "@/lib/types";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
}

function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {title}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                {subtitle}
              </p>
            )}
            {trend !== undefined && (
              <p
                className={`text-xs font-medium mt-1 ${
                  trend >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {trend >= 0 ? "+" : ""}
                {formatPercent(trend)}
              </p>
            )}
          </div>
          <div className="text-slate-400 dark:text-slate-500">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountMetrics() {
  const [metrics, setMetrics] = useState<AccountMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/metrics");
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Account Value"
        value={formatCurrency(metrics.totalValue)}
        subtitle="Available + Positions"
        icon={<Wallet className="w-5 h-5" />}
        trend={metrics.dailyPnL / metrics.totalValue * 100}
      />
      <MetricCard
        title="Available Balance"
        value={formatCurrency(metrics.balance)}
        subtitle="Ready to trade"
        icon={<Wallet className="w-5 h-5" />}
      />
      <MetricCard
        title="Total P&L"
        value={formatCurrency(metrics.totalPnL)}
        subtitle={`Daily: ${formatCurrency(metrics.dailyPnL)}`}
        icon={<TrendingUp className="w-5 h-5" />}
        trend={metrics.dailyPnL !== 0 ? (metrics.dailyPnL / metrics.totalValue) * 100 : 0}
      />
      <MetricCard
        title="Open Positions"
        value={metrics.openPositions.toString()}
        subtitle={`Win Rate: ${metrics.winRate.toFixed(1)}%`}
        icon={<Activity className="w-5 h-5" />}
      />
    </div>
  );
}

