"use client";

import { useState } from "react";
import type { Position } from "@/lib/types";
import { AlertTriangle, X } from "lucide-react";

type OrderPlacementProps = {
  currentPrice: number;
  amount: string;
  activeTab: "BUY" | "SELL";
  selectedPosition?: Position | null;
};

export function OrderPlacement({ currentPrice, amount, activeTab, selectedPosition }: OrderPlacementProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleCloseTrade = async () => {
    if (!selectedPosition) {
      setMessage("No trade selected to close");
      return;
    }

    setIsClosing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/trading/close-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selectedPosition.symbol,
          side: selectedPosition.side,
          size: selectedPosition.size,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to close trade");
      }

      setMessage(result.message || "Trade closed successfully");
      setShowConfirmDialog(false);
      
      // Optionally refresh the page or update positions after a delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      setMessage(error.message || "Failed to close trade");
      setShowConfirmDialog(false);
    } finally {
      setIsClosing(false);
    }
  };

  const handleCloseTradeClick = () => {
    if (!selectedPosition) {
      setMessage("No trade selected to close");
      return;
    }
    setShowConfirmDialog(true);
  };

  const notionalValue = selectedPosition 
    ? (selectedPosition.size || 0) * (selectedPosition.currentPrice || 0)
    : 0;

  return (
    <div className="space-y-2">
      {/* Close Trade Button */}
      <button
        onClick={handleCloseTradeClick}
        disabled={!selectedPosition || isClosing}
        className={`w-full py-2 rounded-lg text-[10px] font-bold text-white transition-all ${
          !selectedPosition || isClosing
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {isClosing ? "Closing..." : selectedPosition ? "Close Trade" : "No Trade Selected"}
      </button>

      {/* Status Message */}
      {message && (
        <div className={`text-[9px] text-center px-2 py-1 rounded ${
          message.includes("success") || message.includes("closed")
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        }`}>
          {message}
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-black/10 p-4 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-[#1A1A1A] mb-1">
                  Confirm Close Trade
                </h3>
                <p className="text-[10px] text-[#666]">
                  Are you sure you want to close this position? This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-[#666]" />
              </button>
            </div>

            {/* Position Details */}
            <div className="bg-[#F5F5F5] rounded-lg p-3 mb-4 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#666]">Symbol</span>
                <span className="text-[10px] font-medium text-[#1A1A1A]">
                  {selectedPosition.symbol}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#666]">Side</span>
                <span className={`text-[10px] font-medium ${
                  selectedPosition.side === "long" ? "text-green-600" : "text-red-600"
                }`}>
                  {selectedPosition.side.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#666]">Size</span>
                <span className="text-[10px] font-medium text-[#1A1A1A]">
                  {selectedPosition.size?.toLocaleString("en-US", {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 8,
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#666]">Notional Value</span>
                <span className="text-[10px] font-medium text-[#1A1A1A]">
                  ${notionalValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {selectedPosition.unrealizedPnl !== undefined && (
                <div className="flex justify-between items-center pt-1.5 border-t border-[#E0E0E0]">
                  <span className="text-[10px] text-[#666]">Unrealized PnL</span>
                  <span className={`text-[10px] font-medium ${
                    (selectedPosition.unrealizedPnl || 0) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}>
                    ${(selectedPosition.unrealizedPnl || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-2 rounded-lg text-[10px] font-bold text-[#1A1A1A] bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseTrade}
                disabled={isClosing}
                className="flex-1 py-2 rounded-lg text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isClosing ? "Closing..." : "Confirm Close"}
              </button>
            </div>
          </div>
      </div>
      )}
    </div>
  );
}

