"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Target,
  X,
  RefreshCw,
  Play,
  Square,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderFormData {
  asset: string;
  amount: string;
  price?: string;
  orderType: "market" | "limit";
  side: "buy" | "sell";
}

export function TradingControls() {
  const [loading, setLoading] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<string[]>(["BTC", "ETH"]); // Default, will be fetched
  const [formData, setFormData] = useState<OrderFormData>({
    asset: "BTC",
    amount: "0.001",
    orderType: "market",
    side: "buy",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch tracked assets on mount
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await fetch("/api/assets");
        if (response.ok) {
          const data = await response.json();
          setAvailableAssets(data.assets || ["BTC", "ETH"]);
          // Set first asset as default if current not in list
          if (data.assets && data.assets.length > 0 && !data.assets.includes(formData.asset)) {
            setFormData({ ...formData, asset: data.assets[0] });
          }
        }
      } catch (error) {
        console.error("Failed to fetch assets:", error);
      }
    };
    fetchAssets();
  }, []);

  const executeAction = async (action: string, data?: any) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/trading/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: result.message || "Action executed successfully" });
        
        // Reset form after successful order
        if (action === "order") {
          setFormData({
            asset: "BTC",
            amount: "0.001",
            orderType: "market",
            side: "buy",
          });
        }
      } else {
        setMessage({ type: "error", text: result.error || "Action failed" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Network error" });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handlePlaceOrder = () => {
    if (!formData.asset || !formData.amount) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    if (formData.orderType === "limit" && !formData.price) {
      setMessage({ type: "error", text: "Price required for limit orders" });
      return;
    }

    executeAction("order", {
      asset: formData.asset,
      side: formData.side,
      amount: parseFloat(formData.amount),
      type: formData.orderType,
      price: formData.price ? parseFloat(formData.price) : undefined,
    });
  };

  return (
    <Card className="rounded-lg">
      <CardHeader className="py-2">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <Activity className="w-4 h-4" />
          Trading Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Test */}
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium text-slate-700">
            Connection
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => executeAction("test")}
              disabled={loading}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors",
                "bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Test Connection
            </button>
            <button
              onClick={() => executeAction("status")}
              disabled={loading}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium transition-colors",
                "bg-white ring-1 ring-black/10 hover:bg-slate-50",
                "text-slate-900 disabled:opacity-50"
              )}
            >
              Check Status
            </button>
          </div>
        </div>

        {/* Place Order Form */}
        <div className="space-y-3 border-t border-slate-200 pt-3">
          <h3 className="text-[13px] font-medium text-slate-700">
            Place Order
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Asset
              </label>
              <select
                value={formData.asset}
                onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
                className="w-full px-3 py-2 border border-black/10 rounded-md bg-white text-slate-900 text-[13px]"
              >
                {availableAssets.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Side
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormData({ ...formData, side: "buy" })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md font-medium transition-colors text-[13px]",
                    formData.side === "buy" ? "bg-black text-white" : "bg-white ring-1 ring-black/10 text-slate-700"
                  )}
                >
                  <TrendingUp className="w-4 h-4" />
                  Buy
                </button>
                <button
                  onClick={() => setFormData({ ...formData, side: "sell" })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md font-medium transition-colors text-[13px]",
                    formData.side === "sell" ? "bg-black text-white" : "bg-white ring-1 ring-black/10 text-slate-700"
                  )}
                >
                  <TrendingDown className="w-4 h-4" />
                  Sell
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Order Type
              </label>
              <select
                value={formData.orderType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    orderType: e.target.value as "market" | "limit",
                  })
                }
                className="w-full px-3 py-2 border border-black/10 rounded-md bg-white text-slate-900 text-[13px]"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Amount
              </label>
              <input
                type="number"
                step="0.000001"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-black/10 rounded-md bg-white text-slate-900 text-[13px]"
                placeholder="0.001"
              />
            </div>
          </div>

          {formData.orderType === "limit" && (
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Price (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price || ""}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 border border-black/10 rounded-md bg-white text-slate-900 text-[13px]"
                placeholder="50000"
              />
            </div>
          )}

          <button
            onClick={handlePlaceOrder}
            disabled={loading}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors",
              formData.side === "buy"
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Play className="w-4 h-4" />
            {loading ? "Placing Order..." : `Place ${formData.side.toUpperCase()} Order`}
          </button>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <h3 className="text-[13px] font-medium text-slate-700">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => executeAction("cancel_all")}
              disabled={loading}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors text-[12px]",
                "bg-black text-white disabled:opacity-50"
              )}
            >
              <X className="w-4 h-4" />
              Cancel All Orders
            </button>
            <button
              onClick={() => executeAction("refresh")}
              disabled={loading}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors text-[12px]",
                "bg-white ring-1 ring-black/10 hover:bg-slate-50",
                "text-slate-900 disabled:opacity-50"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div
            className={cn(
              "p-3 rounded-lg text-sm font-medium",
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            )}
          >
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

