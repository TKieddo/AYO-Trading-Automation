"use client";

import { useEffect, useState } from "react";
import { Clock, Check, X, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/utils";
import type { Order } from "@/lib/types";

const statusConfig = {
  open: {
    label: "Open",
    icon: Clock,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  filled: {
    label: "Filled",
    icon: Check,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  canceled: {
    label: "Canceled",
    icon: X,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400",
  },
  rejected: {
    label: "Rejected",
    icon: AlertCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  triggered: {
    label: "Triggered",
    icon: Check,
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
} as const;

// Default status config for unknown statuses
const defaultStatusConfig = {
  label: "Unknown",
  icon: AlertCircle,
  className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400",
};

export function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/orders");
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        }
      } catch (error: any) {
        // Silently handle connection errors - Python agent may not be running
        if (error.name !== 'TypeError' || !error.message?.includes('fetch')) {
          console.error("Failed to fetch orders:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 3000); // Update every 3s

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            No orders found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Symbol
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Side/Type
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Size
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Price
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Status
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                // Get status config with fallback for unknown statuses
                const status = statusConfig[order.status as keyof typeof statusConfig] || defaultStatusConfig;
                const StatusIcon = status.icon;
                const isBuy = order.side === "buy";

                return (
                  <tr
                    key={order.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {order.symbol}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium w-fit ${
                            isBuy
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {order.side.toUpperCase()}
                        </div>
                        <div className="text-xs text-slate-500 capitalize">
                          {order.type.replace("_", " ")}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-slate-900 dark:text-slate-100">
                        {formatNumber(order.size, 6)}
                      </div>
                      {order.status === "filled" && (
                        <div className="text-xs text-slate-500">
                          Filled: {formatNumber(order.filledSize, 6)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                      {order.price ? formatCurrency(order.price) : "Market"}
                    </td>
                    <td className="py-3 px-4">
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${status.className}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-slate-500 dark:text-slate-500">
                      {formatRelativeTime(order.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

