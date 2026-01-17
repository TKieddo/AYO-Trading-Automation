import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { persistPositions } from "@/lib/supabase/persist";
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

export async function GET() {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    // Fetch from Python agent's /positions endpoint
    const response = await fetch(`${BASE}/agent/positions`, {
      signal: controller.signal,
      cache: "no-store",
    });
    
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      
      // Handle both array format and error format
      if (Array.isArray(data)) {
        // Transform to match our TypeScript Position type
        const transformed = data.map((pos: any, index: number) => ({
          id: pos.id || `${pos.symbol}-${index}`,
          symbol: pos.symbol || pos.coin || "UNKNOWN",
          side: (pos.side || (pos.size > 0 ? "long" : "short")) as "long" | "short",
          size: Math.abs(Number(pos.size) || 0),
          entryPrice: Number(pos.entry_price || pos.entryPrice || pos.entryPx || 0),
          currentPrice: Number(pos.current_price || pos.currentPrice || pos.markPrice || 0),
          liquidationPrice: pos.liquidation_price != null ? Number(pos.liquidation_price) : null,
          unrealizedPnl: Number(pos.unrealized_pnl || pos.unrealizedPnl || pos.pnl || 0),
          realizedPnl: Number(pos.realized_pnl || pos.realizedPnl || 0),
          leverage: pos.leverage != null ? Number(pos.leverage) : null,
          openedAt: pos.opened_at || pos.openedAt || new Date().toISOString(),
          updatedAt: pos.updated_at || pos.updatedAt || new Date().toISOString(),
        }));
        
        persistPositions(transformed).catch(() => {});
        cacheSet("positions", transformed, 5000);
        return NextResponse.json(transformed);
      } else {
        // Error response
        console.error("Positions API returned error:", data);
        return NextResponse.json([], { status: 500 });
      }
    }
  } catch (error: any) {
    // Silently handle connection errors - Python agent may not be running
    if (error.name !== 'AbortError' && error.code !== 'ECONNREFUSED' && !error.message?.includes('fetch failed')) {
      console.error("Failed to fetch positions from Python API:", error);
    }
    const cached = cacheGet<any[]>("positions");
    if (cached) return NextResponse.json(cached);
    // Return empty array when Python agent is offline (will fallback to Supabase if available)
  }
  // Fallback to Supabase (no mock data)
  try {
    const supabase = getSupabase();
    if (supabase) {
      // Only fetch open positions: closed_at IS NULL and size > 0
      const { data, error } = await supabase
        .from("positions")
        .select(
          "id, symbol, side, size, entry_price, current_price, liquidation_price, unrealized_pnl, realized_pnl, leverage, opened_at, updated_at, closed_at"
        )
        .is("closed_at", null)
        .gt("size", 0)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const transformed = (data || [])
        .filter((pos: any) => {
          // Additional safety check: ensure size > 0 and closed_at is null
          return Number(pos.size) > 0 && !pos.closed_at;
        })
        .map((pos: any) => ({
          id: pos.id,
          symbol: pos.symbol,
          side: pos.side,
          size: Number(pos.size),
          entryPrice: Number(pos.entry_price),
          currentPrice: Number(pos.current_price),
          liquidationPrice: pos.liquidation_price ? Number(pos.liquidation_price) : null,
          unrealizedPnl: pos.unrealized_pnl ? Number(pos.unrealized_pnl) : 0,
          realizedPnl: pos.realized_pnl ? Number(pos.realized_pnl) : 0,
          leverage: pos.leverage ?? null,
          openedAt: pos.opened_at,
          updatedAt: pos.updated_at,
        }));

      return NextResponse.json(transformed);
    }
  } catch (e) {
    console.error("Failed to fetch positions from Supabase:", e);
  }

  return NextResponse.json([], { status: 500 });
}

