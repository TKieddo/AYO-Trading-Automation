import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { fetchJsonWithRetry, cacheGet, cacheSet } from "@/lib/http";
import { persistDecisions } from "@/lib/supabase/persist";
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");

    // Fetch from Python agent's /diary endpoint
    const data = await fetchJsonWithRetry<any>(
      `${BASE}/agent/diary?limit=${limit}`,
      { timeoutMs: 5000, cache: "no-store" },
      1,
      100
    );

    // Python API returns {entries: [...]}, transform to Decision type
    const entries = data.entries || [];
    
    // Sort by timestamp descending (most recent first) to show latest decisions at top
    const sortedEntries = [...entries].sort((a: any, b: any) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA; // Descending order
    });
    
    const decisions = sortedEntries.map((entry: any, index: number) => ({
      id: entry.id || `decision-${index}-${entry.timestamp || Date.now()}`,
      asset: entry.asset || "UNKNOWN",
      action: (entry.action?.toLowerCase() || "hold") as "buy" | "sell" | "hold",
      allocationUsd: entry.allocation_usd != null ? entry.allocation_usd : (entry.allocationUsd != null ? entry.allocationUsd : 0),
      tpPrice: entry.tp_price != null ? entry.tp_price : (entry.tpPrice != null ? entry.tpPrice : undefined),
      slPrice: entry.sl_price != null ? entry.sl_price : (entry.slPrice != null ? entry.slPrice : undefined),
      rationale: entry.rationale || "",
      reasoning: entry.reasoning || "",  // Full LLM reasoning text
      timestamp: entry.timestamp || new Date().toISOString(),
    }));

    persistDecisions(decisions).catch(() => {});
    cacheSet("decisions", decisions, 5000);
    return NextResponse.json(decisions);
  } catch (error: any) {
    // Silently handle connection errors - Python agent may not be running
    // Only log non-connection errors in development
    const isConnectionError = error.code === 'ECONNREFUSED' || 
                            error.message?.includes('fetch failed') ||
                            error.message?.includes('ECONNREFUSED');
    
    if (!isConnectionError && process.env.NODE_ENV === 'development') {
      console.error("Failed to fetch decisions from Python API:", error);
    }
    
    const cached = cacheGet<any[]>("decisions");
    if (cached) return NextResponse.json(cached);
    // Continue to Supabase fallback
  }

  // Fallback to Supabase decisions
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("decisions")
        .select(
          "id, asset, action, allocation_usd, tp_price, sl_price, rationale, reasoning, timestamp"
        )
        .order("timestamp", { ascending: false })
        .limit(20);

      if (error) throw error;
      const transformed = (data || []).map((dec: any) => ({
        id: dec.id,
        asset: dec.asset,
        action: dec.action,
        allocationUsd: dec.allocation_usd != null ? Number(dec.allocation_usd) : null,
        tpPrice: dec.tp_price != null ? Number(dec.tp_price) : null,
        slPrice: dec.sl_price != null ? Number(dec.sl_price) : null,
        rationale: dec.rationale || "",
        reasoning: dec.reasoning || "",
        timestamp: dec.timestamp,
      }));
      return NextResponse.json(transformed);
    }
  } catch (e: any) {
    // Silently handle Supabase connection errors
    const isConnectionError = e.code === 'ECONNREFUSED' || 
                              e.message?.includes('fetch failed') ||
                              e.message?.includes('ECONNREFUSED');
    
    if (!isConnectionError && process.env.NODE_ENV === 'development') {
      console.error("Failed to fetch decisions from Supabase:", e);
    }
  }

  // Return empty array instead of 500 error - component will show demo data
  return NextResponse.json([]);
}

