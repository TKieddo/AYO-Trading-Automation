"use client";

import { useEffect, useRef, useState } from "react";
import type { Position } from "@/lib/types";

type Timeframe = "5m" | "1h" | "8h" | "1D" | "1W";

type TradingViewChartProps = {
  symbol: string;
  selectedTimeframe?: Timeframe;
  entryPrice?: number;
  selectedPosition?: Position | null;
  positions?: Position[];
  activeTab?: "LONG" | "SHORT";
  height?: number;
};

/**
 * TradingView Advanced Chart Widget Component
 * 
 * This component embeds TradingView's Advanced Real-Time Chart widget.
 * 
 * Features:
 * - Real-time price data from TradingView
 * - Full TradingView charting tools and indicators
 * - Users can manually draw price lines using TradingView's built-in drawing tools
 * - Note: Programmatic price lines require TradingView Charting Library (paid license)
 */
export function TradingViewChart({
  symbol,
  selectedTimeframe = "8h",
  entryPrice,
  selectedPosition,
  positions = [],
  activeTab = "LONG",
  height = 380,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
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

  useEffect(() => {
    if (!containerRef.current) return;

    // Format symbol for TradingView Binance Perpetual Futures
    // Formats: "BTC/USDT" -> "BINANCE:BTCUSDT" or "BTC" -> "BINANCE:BTCUSDT"
    const formatSymbol = (sym: string): string => {
      if (!sym) return "BINANCE:BTCUSDT"; // Default fallback
      
      // Remove any slashes, dashes, and normalize to uppercase
      let cleanSymbol = sym.toUpperCase().replace(/[\/\-]/g, "");
      
      // Remove any existing USDT or USD suffix to avoid duplication
      cleanSymbol = cleanSymbol.replace(/USDT?$/i, "");
      
      // Always add USDT for Binance Perpetual Futures
      cleanSymbol = `${cleanSymbol}USDT`;
      
      // Return in TradingView format for Binance Perpetual Futures
      return `BINANCE:${cleanSymbol}`;
    };

    // Clear previous widget and error state
    if (widgetRef.current) {
      containerRef.current.innerHTML = "";
      widgetRef.current = null;
      setIsLoaded(false);
    }
    setError(null);

    // Create unique container ID
    const containerId = `tradingview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    containerRef.current.id = containerId;

    // Function to create widget
    const createWidget = () => {
      // Double-check that container exists and is in the DOM
      if (!containerRef.current) {
        console.warn("Container ref is null, retrying...");
        setTimeout(createWidget, 100);
        return;
      }

      // Verify the element is actually in the DOM
      if (!containerRef.current.parentNode) {
        console.warn("Container element not in DOM, retrying...");
        setTimeout(createWidget, 100);
        return;
      }
      
      // Check if TradingView is available
      if (!(window as any).TradingView) {
        console.warn("TradingView library not available, retrying...");
        setTimeout(createWidget, 100);
        return;
      }

      try {
        const formattedSymbol = formatSymbol(symbol);
        console.log(`Loading TradingView chart for symbol: ${formattedSymbol} (original: ${symbol})`);
        
        // Verify container still exists before creating widget
        const container = document.getElementById(containerId);
        if (!container || !container.parentNode) {
          console.warn("Container not found in DOM, retrying...");
          setTimeout(createWidget, 100);
          return;
        }
        
        widgetRef.current = new (window as any).TradingView.widget({
          autosize: true,
          symbol: formattedSymbol,
          interval: tvTimeframe,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#000000",
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: containerId,
          hide_side_toolbar: false,
          disabled_features: [
            "use_localstorage_for_settings",
            "volume_force_overlay",
            "create_volume_indicator_by_default",
          ],
          enabled_features: [
            "study_templates",
            "side_toolbar_in_fullscreen_mode",
            "header_in_all_windows",
          ],
          overrides: {
            "paneProperties.background": "#000000",
            "paneProperties.backgroundType": "solid",
            "paneProperties.showPriceLine": true,
            "paneProperties.showVolumePane": false,
            // Dark mode candle colors
            "mainSeriesProperties.candleStyle.upColor": "#10b981",
            "mainSeriesProperties.candleStyle.downColor": "#ef4444",
            "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
            "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
            "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
          },
        });
        
        setIsLoaded(true);
      } catch (error) {
        console.error("Error creating TradingView widget:", error);
        setError(`Failed to initialize TradingView chart. Symbol: ${formatSymbol(symbol)}`);
      }
    };

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src*="tradingview.com"]');
    if (existingScript && (window as any).TradingView) {
      // Script already loaded, wait for next frame to ensure DOM is ready
      requestAnimationFrame(() => {
        setTimeout(createWidget, 50);
      });
    } else {
      // Load the script
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      
      script.onload = () => {
        if ((window as any).TradingView) {
          // Wait for next frame to ensure DOM is ready
          requestAnimationFrame(() => {
            setTimeout(createWidget, 50);
          });
        } else {
          console.error("TradingView library not available after script load");
          setError("TradingView library failed to load");
        }
      };

      script.onerror = () => {
        console.error("Failed to load TradingView script from CDN");
        // Fallback: Try alternative loading method or show error
        setError("Unable to load TradingView chart. Please check your internet connection.");
      };

      // Append script to head instead of body for better compatibility
      const head = document.head || document.getElementsByTagName("head")[0];
      head.appendChild(script);
    }

    return () => {
      // Cleanup widget
      if (widgetRef.current && containerRef.current) {
        try {
        containerRef.current.innerHTML = "";
        } catch (e) {
          // Ignore cleanup errors
        }
        widgetRef.current = null;
      }
    };
  }, [symbol, tvTimeframe]);

  // Inject CSS to make TradingView header dark and remove grey backgrounds
  useEffect(() => {
    const styleId = 'tradingview-header-dark';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .tradingview-widget-container .tv-header,
        .tradingview-widget-container .tv-header-container,
        .tradingview-widget-container .tv-header__top,
        .tradingview-widget-container .tv-header__top-wrapper,
        .tradingview-widget-container .tv-header__top-wrapper > div,
        .tradingview-widget-container .tv-header__top-wrapper > div > div {
          background-color: #000000 !important;
          background: #000000 !important;
        }
        .tradingview-widget-container .tv-header__top {
          border-bottom: 1px solid #1f2937 !important;
        }
        .tradingview-widget-container iframe {
          background-color: #000000 !important;
        }
        .tradingview-widget-container .tv-control-bar,
        .tradingview-widget-container .tv-control-bar__group {
          background-color: #000000 !important;
          background: #000000 !important;
        }
        .tradingview-widget-container .tv-button,
        .tradingview-widget-container .tv-button--active {
          background-color: transparent !important;
        }
        .tradingview-widget-container .tv-button:hover {
          background-color: #1f2937 !important;
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full h-full rounded-lg overflow-hidden"
        style={{ 
          height: `${height}px`, 
          minHeight: `${height}px`,
          backgroundColor: '#000000'
        }}
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg border border-red-200 z-20">
          <div className="text-red-600 text-sm text-center px-4">
            {error}
            <div className="text-xs mt-2 text-red-500">
              The TradingView chart requires an internet connection to load.
            </div>
          </div>
        </div>
      )}
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-lg">
          <div className="text-slate-400 text-sm">Loading TradingView chart...</div>
        </div>
      )}
    </div>
  );
}

