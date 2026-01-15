import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { cacheGet, cacheSet } from "@/lib/http";
import { persistPerformance } from "@/lib/supabase/persist";
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

export async function GET() {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    const response = await fetch(`${BASE}/agent/api/performance`, {
      signal: controller.signal,
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    clearTimeout(timeoutId);
    
    if (response.ok) {
      const raw = await response.json();
      if (Array.isArray(raw)) {
        const mapped = raw.map((r: any) => ({
          date: r.date || r.timestamp || r.time || new Date().toISOString(),
          value: Number(r.value ?? r.equity ?? r.account_value ?? 0),
          pnl: Number(r.pnl ?? r.daily_pnl ?? 0),
        }));
        const nonEmpty = mapped.filter((m: any) => m.date && (m.value !== 0 || m.pnl !== 0));
        if (nonEmpty.length > 0) {
          persistPerformance(nonEmpty).catch(() => {});
          cacheSet("performance", nonEmpty, 5000);
          return NextResponse.json(nonEmpty);
        }
      }
    }
  } catch (error: any) {
    // Silently handle connection errors - Python agent may not be running
    if (error.name !== 'AbortError' && error.code !== 'ECONNREFUSED' && !error.message?.includes('fetch failed')) {
      console.error("Failed to fetch performance from Python API:", error);
    }
    const cached = cacheGet<any[]>("performance");
    if (cached) return NextResponse.json(cached);
  }

  // Fallback 1: derive from PNL API if Supabase missing
  try {
    const pnlResp = await fetch(`${BASE}/api/pnl`, { cache: "no-store" });
    if (pnlResp.ok) {
      const pnlData = await pnlResp.json();
      if (Array.isArray(pnlData) && pnlData.length > 0) {
        let baseValue = 10000;
        const series = pnlData.map((p: any) => ({
          date: p.timestamp,
          value: baseValue + Number(p.cumulative_pnl ?? 0),
          pnl: Number(p.daily_pnl ?? 0),
        }));
        return NextResponse.json(series);
      }
    }
  } catch {}

  // Fallback 2: derive from Supabase trades/orders if available
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("trades")
        .select("executed_at, pnl")
        .order("executed_at", { ascending: true });
      if (error) throw error;

      let cumulative = 0;
      let baseValue = 10000; // Default base value
      const series = (data || []).map((t: any) => {
        const daily = t.pnl != null ? Number(t.pnl) : 0;
        cumulative += daily;
        const value = baseValue + cumulative;
        return {
          date: t.executed_at,
          value: value,
          pnl: daily,
        };
      });
      return NextResponse.json(series);
    }
  } catch (e) {
    console.error("Failed to derive performance from Supabase:", e);
  }

  return NextResponse.json([]);
}

