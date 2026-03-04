"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Position } from "@/lib/types";

type Timeframe = "5m" | "1h" | "8h" | "1D" | "1W";

type TradingViewAdvancedChartProps = {
  symbol: string;
  selectedTimeframe?: Timeframe;
  positions?: Position[];
  selectedPosition?: Position | null;
  activeTab?: "LONG" | "SHORT";
  height?: number;
};

/**
 * TradingView Advanced Chart with Full Functionality
 * 
 * This component uses TradingView Charting Library to display:
 * - Real-time price data
 * - Entry price markers for all positions
 * - Current position indicators
 * - Stop-loss and take-profit levels
 * - Dynamic updates as positions change
 * 
 * NOTE: TradingView Charting Library requires a license for commercial use.
 * For development/testing, you can use it with limitations.
 * Get a license at: https://www.tradingview.com/pricing/
 */
export function TradingViewAdvancedChart({
  symbol,
  selectedTimeframe = "8h",
  positions = [],
  selectedPosition,
  activeTab = "LONG",
  height = 380,
}: TradingViewAdvancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const datafeedRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map our timeframes to TradingView timeframes
  const timeframeMap: Record<Timeframe, string> = {
    "5m": "5",
    "1h": "60",
    "8h": "480",
    "1D": "D",
    "1W": "W",
  };

  const tvTimeframe = timeframeMap[selectedTimeframe] || "480";

  // Format symbol for TradingView
  const formatSymbol = (sym: string): string => {
    const cleanSymbol = sym.replace("/", "").replace("USD", "USDT");
    return `BINANCE:${cleanSymbol}`;
  };

  // Create data feed adapter
  const createDataFeed = useCallback(() => {
    return {
      onReady: (callback: any) => {
        setTimeout(() => {
          callback({
            supported_resolutions: ["5", "60", "480", "D", "W"],
            supports_group_request: false,
            supports_marks: true,
            supports_search: true,
            supports_timescale_marks: false,
          });
        }, 0);
      },
      searchSymbols: async (
        userInput: string,
        exchange: string,
        symbolType: string,
        onResult: (symbols: any[]) => void
      ) => {
        // Simple symbol search
        const symbols = [
          {
            symbol: formatSymbol(symbol),
            full_name: formatSymbol(symbol),
            description: symbol,
            exchange: "BINANCE",
            type: "crypto",
          },
        ];
        onResult(symbols);
      },
      resolveSymbol: async (
        symbolName: string,
        onResolve: (symbolInfo: any) => void,
        onError: (error: string) => void
      ) => {
        const symbolInfo = {
          name: symbolName,
          ticker: symbolName,
          description: symbol,
          type: "crypto",
          session: "24x7",
          timezone: "Etc/UTC",
          exchange: "BINANCE",
          minmov: 1,
          pricescale: 100,
          has_intraday: true,
          has_weekly_and_monthly: true,
          supported_resolutions: ["5", "60", "480", "D", "W"],
          volume_precision: 2,
          data_status: "streaming",
        };
        onResolve(symbolInfo);
      },
      getBars: async (
        symbolInfo: any,
        resolution: string,
        periodParams: any,
        onResult: (bars: any[], meta: any) => void,
        onError: (error: string) => void
      ) => {
        try {
          // Fetch historical data from your API
          const response = await fetch(
            `/api/charts/history?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${periodParams.from}&to=${periodParams.to}`
          );
          
          if (!response.ok) {
            throw new Error("Failed to fetch chart data");
          }

          const data = await response.json();
          
          if (data.error) {
            onError(data.error);
            return;
          }

          const bars = (data.bars || []).map((bar: any) => ({
            time: bar.time * 1000, // Convert to milliseconds
            low: bar.low,
            high: bar.high,
            open: bar.open,
            close: bar.close,
            volume: bar.volume || 0,
          }));

          onResult(bars, { noData: bars.length === 0 });
        } catch (err: any) {
          console.error("Error fetching bars:", err);
          onError(err.message || "Failed to fetch data");
        }
      },
      subscribeBars: (
        symbolInfo: any,
        resolution: string,
        onTick: (bar: any) => void,
        subscriberUID: string,
        onResetCacheNeededCallback: () => void
      ) => {
        // Subscribe to real-time updates
        const interval = setInterval(async () => {
          try {
            const response = await fetch(`/api/prices`);
            if (response.ok) {
              const prices = await response.json();
              const priceData = prices.find((p: any) => 
                p.symbol === symbol || p.symbol === symbol.replace("/", "")
              );
              
              if (priceData) {
                const now = Date.now();
                onTick({
                  time: now,
                  low: priceData.price,
                  high: priceData.price,
                  open: priceData.price,
                  close: priceData.price,
                  volume: 0,
                });
              }
            }
          } catch (err) {
            console.error("Error subscribing to bars:", err);
          }
        }, 5000); // Update every 5 seconds

        // Store interval for cleanup
        (datafeedRef.current as any).intervals = (datafeedRef.current as any).intervals || {};
        (datafeedRef.current as any).intervals[subscriberUID] = interval;
      },
      unsubscribeBars: (subscriberUID: string) => {
        const intervals = (datafeedRef.current as any)?.intervals;
        if (intervals && intervals[subscriberUID]) {
          clearInterval(intervals[subscriberUID]);
          delete intervals[subscriberUID];
        }
      },
    };
  }, [symbol]);

  // Add position markers to chart
  const addPositionMarkers = useCallback(() => {
    if (!chartRef.current || !positions || positions.length === 0) return;

    // Filter positions by active tab
    const filteredPositions = positions.filter(
      (pos) => pos.side === activeTab.toLowerCase()
    );

    // Remove existing markers
    chartRef.current.removeAllShapes?.();
    chartRef.current.removeAllStudies?.();

    // Add markers for each position
    filteredPositions.forEach((position, index) => {
      const isSelected = selectedPosition?.id === position.id;
      const color = position.side === "long" ? "#10b981" : "#ef4444";
      const markerColor = isSelected ? "#8c4efd" : color;

      // Add entry price line
      chartRef.current.createShape?.(
        {
          time: Date.now() - 86400000, // 1 day ago
          price: position.entryPrice,
        },
        {
          time: Date.now() + 86400000, // 1 day ahead
          price: position.entryPrice,
        },
        {
          shape: "trend_line",
          lock: true,
          disableSelection: true,
          disableSave: true,
          overrides: {
            linecolor: markerColor,
            linewidth: isSelected ? 2 : 1,
            linestyle: isSelected ? 0 : 2, // 0 = solid, 2 = dashed
            showLabel: true,
            showPrice: true,
            axisLabelVisible: true,
            text: `Entry: ${position.symbol} ${position.side.toUpperCase()}`,
          },
        }
      );

      // Add current price marker
      chartRef.current.createShape?.(
        {
          time: Date.now(),
          price: position.currentPrice,
        },
        {
          time: Date.now(),
          price: position.currentPrice,
        },
        {
          shape: "circle",
          lock: true,
          disableSelection: true,
          disableSave: true,
          overrides: {
            linecolor: markerColor,
            fillColor: markerColor,
            linewidth: 2,
            radius: isSelected ? 8 : 5,
            showLabel: true,
            showPrice: true,
            text: `Current: ${position.symbol}`,
          },
        }
      );

      // Add exchange-confirmed stop-loss if available (fallback to liquidation).
      const displaySlPrice = position.slPrice ?? position.liquidationPrice;
      if (displaySlPrice) {
        chartRef.current.createShape?.(
          {
            time: Date.now() - 86400000,
            price: displaySlPrice,
          },
          {
            time: Date.now() + 86400000,
            price: displaySlPrice,
          },
          {
            shape: "trend_line",
            lock: true,
            disableSelection: true,
            disableSave: true,
            overrides: {
              linecolor: "#f59e0b",
              linewidth: 1,
              linestyle: 2, // dashed
              showLabel: true,
              showPrice: true,
              text: `SL: ${position.symbol}`,
            },
          }
        );
      }
    });
  }, [positions, selectedPosition, activeTab]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if TradingView library is available
    if (!(window as any).TradingView) {
      setError("TradingView library not loaded. Please check your license setup.");
      return;
    }

    const widget = (window as any).TradingView;

    // Create data feed
    const datafeed = createDataFeed();
    datafeedRef.current = datafeed;

    // Initialize chart
    const chart = new widget.charting_library({
      container: containerRef.current,
      datafeed: datafeed,
      symbol: formatSymbol(symbol),
      interval: tvTimeframe,
      library_path: "/charting_library/",
      locale: "en",
      disabled_features: [
        "use_localstorage_for_settings",
        "volume_force_overlay",
        "create_volume_indicator_by_default",
        "header_widget",
        "header_symbol_search",
        "header_compare",
        "header_screenshot",
        "header_chart_type",
        "header_resolutions",
        "header_save_load",
        "header_undo_redo",
        "header_screenshot",
        "header_fullscreen_button",
        "show_logo_on_all_charts",
        "header_widget_dom_node",
      ],
      enabled_features: [
        "study_templates",
        "side_toolbar_in_fullscreen_mode",
        "header_in_all_windows",
      ],
      charts_storage_url: "",
      charts_storage_api_version: "1.1",
      client_id: "tradingview.com",
      user_id: "public_user_id",
      fullscreen: false,
      autosize: true,
      studies_overrides: {},
      theme: "light",
      overrides: {
        "paneProperties.background": "#ffffff",
        "paneProperties.backgroundType": "solid",
        "mainSeriesProperties.candleStyle.upColor": "#10b981",
        "mainSeriesProperties.candleStyle.downColor": "#ef4444",
        "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
        "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
        "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
        "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
      },
      loading_screen: { backgroundColor: "#ffffff" },
    });

    chartRef.current = chart;
    setIsLoaded(true);
    setError(null);

    // Add position markers after chart is ready
    chart.onChartReady(() => {
      setTimeout(() => {
        addPositionMarkers();
      }, 1000);
    });

    return () => {
      // Cleanup
      if (chartRef.current) {
        chartRef.current.remove?.();
        chartRef.current = null;
      }
      const intervals = (datafeedRef.current as any)?.intervals;
      if (intervals) {
        Object.values(intervals).forEach((interval: any) => {
          clearInterval(interval);
        });
      }
    };
  }, [symbol, tvTimeframe, createDataFeed]);

  // Update position markers when positions change
  useEffect(() => {
    if (isLoaded && chartRef.current) {
      addPositionMarkers();
    }
  }, [positions, selectedPosition, activeTab, isLoaded, addPositionMarkers]);

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      <div
        ref={containerRef}
        className="tradingview-chart-container w-full h-full rounded-lg overflow-hidden"
        style={{ height: `${height}px` }}
      />
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-lg">
          <div className="text-slate-500 text-sm">Loading TradingView chart...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg border border-red-200">
          <div className="text-red-600 text-sm text-center px-4">
            {error}
            <div className="text-xs mt-2 text-red-500">
              Note: TradingView Charting Library requires a license for commercial use.
              <br />
              For now, using the free widget with limited functionality.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

