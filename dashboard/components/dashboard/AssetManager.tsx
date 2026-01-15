"use client";

import { useEffect, useState } from "react";
import { Settings, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PriceTicker } from "@/components/dashboard/PriceTicker";

export function AssetManager() {
  const [trackedAssets, setTrackedAssets] = useState<string[]>([]);
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newAsset, setNewAsset] = useState("");

  const fetchAssets = async () => {
    try {
      const [trackedRes, availableRes] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/available-assets"),
      ]);

      if (trackedRes.ok) {
        const tracked = await trackedRes.json();
        setTrackedAssets(tracked.assets || []);
      }

      if (availableRes.ok) {
        const available = await availableRes.json();
        setAvailableAssets(available.assets || []);
      }
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const addAsset = async (asset: string) => {
    if (!asset || trackedAssets.includes(asset.toUpperCase())) {
      return;
    }

    setLoading(true);
    try {
      const updatedAssets = [...trackedAssets, asset.toUpperCase()];
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: updatedAssets }),
      });

      if (response.ok) {
        setTrackedAssets(updatedAssets);
        setNewAsset("");
        setMessage({
          type: "success",
          text: "Asset added. Update TRACKED_ASSETS in .env for persistence.",
        });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to add asset" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const removeAsset = async (asset: string) => {
    if (trackedAssets.length <= 1) {
      setMessage({ type: "error", text: "At least one asset must be tracked" });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    setLoading(true);
    try {
      const updatedAssets = trackedAssets.filter((a) => a !== asset);
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: updatedAssets }),
      });

      if (response.ok) {
        setTrackedAssets(updatedAssets);
        setMessage({
          type: "success",
          text: "Asset removed. Update TRACKED_ASSETS in .env for persistence.",
        });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to remove asset" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (newAsset.trim()) {
      addAsset(newAsset.trim());
    }
  };

  // Filter out already tracked assets from available list
  const untrackedAssets = availableAssets.filter((a) => !trackedAssets.includes(a));

  // Get premium color scheme for each asset
  const getAssetColor = (asset: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      BTC: { bg: "from-orange-400/30 via-orange-300/25 to-yellow-400/20", text: "text-orange-700", border: "border-orange-300/40" },
      ETH: { bg: "from-blue-400/30 via-indigo-300/25 to-purple-400/20", text: "text-blue-700", border: "border-blue-300/40" },
      SOL: { bg: "from-purple-400/30 via-pink-300/25 to-violet-400/20", text: "text-purple-700", border: "border-purple-300/40" },
      BNB: { bg: "from-yellow-400/30 via-amber-300/25 to-orange-400/20", text: "text-yellow-700", border: "border-yellow-300/40" },
      DOGE: { bg: "from-amber-400/30 via-yellow-300/25 to-orange-400/20", text: "text-amber-700", border: "border-amber-300/40" },
      ADA: { bg: "from-emerald-400/30 via-teal-300/25 to-cyan-400/20", text: "text-emerald-700", border: "border-emerald-300/40" },
      MATIC: { bg: "from-purple-400/30 via-pink-300/25 to-rose-400/20", text: "text-purple-700", border: "border-purple-300/40" },
      DOT: { bg: "from-pink-400/30 via-rose-300/25 to-red-400/20", text: "text-pink-700", border: "border-pink-300/40" },
      AVAX: { bg: "from-red-400/30 via-rose-300/25 to-pink-400/20", text: "text-red-700", border: "border-red-300/40" },
      LINK: { bg: "from-cyan-400/30 via-blue-300/25 to-indigo-400/20", text: "text-cyan-700", border: "border-cyan-300/40" },
    };
    return colors[asset.toUpperCase()] || { 
      bg: "from-gray-400/30 via-gray-300/25 to-slate-400/20", 
      text: "text-gray-700", 
      border: "border-gray-300/40" 
    };
  };

  return (
    <div className="bg-transparent rounded-2xl border border-[#E0E0E0] p-6">
      {/* Premium Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4 text-[#666]" />
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Tracked Assets</h2>
        </div>
      </div>

      {/* Prices for tracked assets - Premium Layout */}
      <div className="mb-6">
        <PriceTicker />
      </div>

      {/* Currently Tracked Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-[#666] uppercase tracking-wider">
            Currently Tracked
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {trackedAssets.map((asset) => {
            return (
              <div
                key={asset}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#1A1A1A] bg-[#1A1A1A] text-white shadow-sm hover:bg-[#2A2A2A] transition-all"
              >
                <span className="font-semibold text-[11px] text-white">{asset}</span>
                <button
                  onClick={() => removeAsset(asset)}
                  disabled={loading}
                  className="hover:bg-white/20 rounded p-0.5 disabled:opacity-50 transition-colors text-white"
                  title="Remove asset"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add new asset */}
      <div className="border-t border-[#E0E0E0] pt-4">
        <label className="block text-xs font-medium text-[#666] uppercase tracking-wider mb-2">
          Add Asset
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newAsset}
            onChange={(e) => setNewAsset(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === "Enter" && handleAddNew()}
            placeholder="Enter asset symbol (e.g., BTC)"
            className="flex-1 px-3 py-2 border border-[#E0E0E0] rounded-md bg-white/80 backdrop-blur-sm text-[#1A1A1A] placeholder:text-[#999] focus:outline-none focus:ring-1 focus:ring-[#8c4efd]/20 focus:border-[#8c4efd] transition-all"
            disabled={loading}
          />
          <button
            onClick={handleAddNew}
            disabled={loading || !newAsset.trim()}
            className={cn(
              "px-4 py-2 rounded-md font-medium transition-colors",
              "bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Available assets quick add */}
      {untrackedAssets.length > 0 && (
        <div className="border-t border-[#E0E0E0] pt-4 mt-4">
          <label className="block text-xs font-medium text-[#666] uppercase tracking-wider mb-2">
            Quick Add
          </label>
          <div className="flex flex-wrap gap-2">
            {untrackedAssets.slice(0, 20).map((asset) => (
              <button
                key={asset}
                onClick={() => addAsset(asset)}
                disabled={loading || trackedAssets.includes(asset)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  "bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-[#E0E0E0]",
                  "text-[#1A1A1A]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {asset}
              </button>
            ))}
          </div>
          {untrackedAssets.length > 20 && (
            <p className="text-[10px] text-[#999] mt-2">
              +{untrackedAssets.length - 20} more available
            </p>
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={cn(
            "p-3 rounded-md text-xs font-medium mt-4",
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          )}
        >
          {message.text}
        </div>
      )}

      {/* Info */}
      <div className="text-[10px] text-[#999] pt-4 mt-4 border-t border-[#E0E0E0]">
        💡 Update <code className="bg-white/60 px-1 rounded border border-[#E0E0E0]">TRACKED_ASSETS</code> in your{" "}
        <code className="bg-white/60 px-1 rounded border border-[#E0E0E0]">.env</code> file to persist changes
      </div>
    </div>
  );
}

