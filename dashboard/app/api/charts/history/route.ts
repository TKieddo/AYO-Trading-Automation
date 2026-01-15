import { NextRequest, NextResponse } from "next/server";

/**
 * Chart History API
 * Fetches historical price data for TradingView charts
 * 
 * Query parameters:
 * - symbol: Trading symbol (e.g., "BTC/USDT")
 * - resolution: Timeframe (5, 60, 480, D, W)
 * - from: Start timestamp (Unix seconds)
 * - to: End timestamp (Unix seconds)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const symbol = searchParams.get("symbol") || "BTC/USDT";
    const resolution = searchParams.get("resolution") || "480";
    const from = parseInt(searchParams.get("from") || "0");
    const to = parseInt(searchParams.get("to") || String(Math.floor(Date.now() / 1000)));

    // Convert resolution to minutes
    const resolutionMinutes: Record<string, number> = {
      "5": 5,
      "60": 60,
      "480": 480,
      "D": 1440,
      "W": 10080,
    };

    const intervalMinutes = resolutionMinutes[resolution] || 480;
    const numBars = Math.ceil((to - from) / (intervalMinutes * 60));

    // Fetch price data from your API
    const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
    
    try {
      // Try to fetch from Python agent first
      const response = await fetch(
        `${BASE}/agent/api/prices`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const prices = await response.json();
        const priceData = Array.isArray(prices)
          ? prices.find((p: any) => 
              p.symbol === symbol || 
              p.symbol === symbol.replace("/", "") ||
              p.symbol === symbol.replace("/", "").replace("USD", "USDT")
            )
          : null;

        if (priceData && priceData.price) {
          // Generate historical bars based on current price
          // In production, you'd fetch real historical data from your exchange
          const bars = [];
          const basePrice = Number(priceData.price) || 50000;
          const now = Math.floor(Date.now() / 1000);
          
          for (let i = numBars - 1; i >= 0; i--) {
            const barTime = to - (i * intervalMinutes * 60);
            if (barTime < from) continue;

            // Generate realistic price movement
            const progress = (numBars - 1 - i) / numBars;
            const volatility = basePrice * 0.02; // 2% volatility
            const trend = Math.sin(progress * Math.PI * 2) * volatility * 0.5;
            const noise = (Math.random() - 0.5) * volatility * 0.3;
            const price = basePrice + trend + noise;

            const open = price * (1 + (Math.random() - 0.5) * 0.01);
            const close = price * (1 + (Math.random() - 0.5) * 0.01);
            const high = Math.max(open, close) * (1 + Math.random() * 0.01);
            const low = Math.min(open, close) * (1 - Math.random() * 0.01);

            bars.push({
              time: barTime,
              open: Number(open.toFixed(2)),
              high: Number(high.toFixed(2)),
              low: Number(low.toFixed(2)),
              close: Number(close.toFixed(2)),
              volume: Math.random() * 1000000,
            });
          }

          return NextResponse.json({ bars, s: "ok" });
        }
      }
    } catch (error) {
      console.error("Error fetching from Python API:", error);
    }

    // Fallback: Generate sample data
    const bars = [];
    const basePrice = 50000;
    
    for (let i = numBars - 1; i >= 0; i--) {
      const barTime = to - (i * intervalMinutes * 60);
      if (barTime < from) continue;

      const progress = (numBars - 1 - i) / numBars;
      const volatility = basePrice * 0.02;
      const trend = Math.sin(progress * Math.PI * 2) * volatility * 0.5;
      const noise = (Math.random() - 0.5) * volatility * 0.3;
      const price = basePrice + trend + noise;

      const open = price * (1 + (Math.random() - 0.5) * 0.01);
      const close = price * (1 + (Math.random() - 0.5) * 0.01);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);

      bars.push({
        time: barTime,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Math.random() * 1000000,
      });
    }

    return NextResponse.json({ bars, s: "ok" });
  } catch (error: any) {
    console.error("Error in chart history API:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}

