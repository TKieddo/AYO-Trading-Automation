import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/http";
const PYTHON_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

export async function GET() {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    // Fetch from Python agent's /positions endpoint
    const response = await fetch(`${PYTHON_API_URL}/positions`, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    });
    
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      
      // Handle both array format and error format
      if (Array.isArray(data)) {
        // Transform to match our TypeScript Position type
        const transformed = data.map((pos: any, index: number) => {
          // Extract size - handle multiple field names
          const rawSize = pos.size || pos.quantity || pos.positionAmt || pos.szi || 0;
          const size = Math.abs(Number(rawSize) || 0);
          
          // Extract leverage - handle multiple field names
          const leverage = pos.leverage != null && pos.leverage !== undefined 
            ? Number(pos.leverage) 
            : null;
          
          // Extract ROI - handle multiple field names
          const roiPercent = (pos.roiPercent != null && pos.roiPercent !== undefined)
            ? Number(pos.roiPercent)
            : (pos.roi != null && pos.roi !== undefined)
            ? Number(pos.roi)
            : null;
          
          return {
            id: pos.id || `${pos.symbol || pos.coin || "UNKNOWN"}-${index}`,
            symbol: pos.symbol || pos.coin || "UNKNOWN",
            side: (pos.side || (size > 0 ? "long" : "short")) as "long" | "short",
            size: size,
            entryPrice: Number(pos.entry_price || pos.entryPrice || pos.entryPx || 0),
            currentPrice: Number(pos.current_price || pos.currentPrice || pos.markPrice || 0),
            liquidationPrice: pos.liquidation_price != null ? Number(pos.liquidation_price) : null,
            tpPrice: pos.tp_price != null ? Number(pos.tp_price) : null,
            slPrice: pos.sl_price != null ? Number(pos.sl_price) : null,
            tpOid: pos.tp_oid != null ? String(pos.tp_oid) : null,
            slOid: pos.sl_oid != null ? String(pos.sl_oid) : null,
            unrealizedPnl: Number(pos.unrealized_pnl || pos.unrealizedPnl || pos.pnl || 0),
            realizedPnl: Number(pos.realized_pnl || pos.realizedPnl || 0),
            leverage: leverage,
            initialMargin: (pos.initial_margin != null && pos.initial_margin !== undefined) 
              ? Number(pos.initial_margin) 
              : ((pos.positionInitialMargin != null && pos.positionInitialMargin !== undefined)
                ? Number(pos.positionInitialMargin)
                : null),
            roiPercent: roiPercent,
            notional: pos.notional != null ? Number(pos.notional) : null,
            openedAt: pos.opened_at || pos.openedAt || new Date().toISOString(),
            openTime: pos.openTime != null ? Number(pos.openTime) : (pos.openedAt && typeof pos.openedAt === 'number' ? pos.openedAt : null),
            updatedAt: pos.updated_at || pos.updatedAt || new Date().toISOString(),
          };
        });
        
        cacheSet("positions", transformed, 2000); // Cache for 2s for real-time updates
        return NextResponse.json(transformed);
      } else {
        // Error response
        console.error("Positions API returned error:", data);
        return NextResponse.json([], { status: 500 });
      }
    }
  } catch (error: any) {
    // Handle connection errors - Python agent may not be running
    if (error.name !== 'AbortError' && error.code !== 'ECONNREFUSED' && !error.message?.includes('fetch failed')) {
      console.error("Failed to fetch positions from Python API:", error);
    }
    
    // Return cached data if available, otherwise empty array
    const cached = cacheGet<any[]>("positions");
    if (cached) {
      return NextResponse.json(cached);
    }
    
    // Return empty array when Python agent is offline (no database fallback)
    return NextResponse.json([], { status: 503 });
  }
}

