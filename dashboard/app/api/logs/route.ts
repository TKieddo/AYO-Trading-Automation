import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { fetchJsonWithRetry, cacheGet, cacheSet } from "@/lib/http";
import { persistLogs } from "@/lib/supabase/persist";
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const path = searchParams.get("path") || "trading_agent.log";

    // Fetch from Python agent's /logs endpoint (request JSON format)
    const logs = await fetchJsonWithRetry<any[]>(
      `${BASE}/agent/logs?limit=${limit}&path=${path}&format=json`,
      { timeoutMs: 20000, cache: "no-store" },
      2,
      300
    );
    
    // If already an array, cache briefly (logs change fast)
    if (Array.isArray(logs)) {
      persistLogs(logs).catch(() => {});
      cacheSet("logs", logs, 2000);
      return NextResponse.json(logs);
    }
    
    // Fallback: if it's plain text, parse it
    const text = typeof logs === 'string' ? logs : JSON.stringify(logs);
    const lines = text.split('\n').filter(line => line.trim());
    const parsedLogs = lines.map((line, index) => {
      return {
        id: `log-${index}`,
        level: "info" as const,
        message: line,
        timestamp: new Date().toISOString(),
      };
    });

    persistLogs(parsedLogs).catch(() => {});
    cacheSet("logs", parsedLogs, 2000);
    return NextResponse.json(parsedLogs);
  } catch (error: any) {
    // Silently handle connection errors - Python agent may not be running
    if (error.code !== 'ECONNREFUSED' && !error.message?.includes('fetch failed')) {
      console.error("Failed to fetch logs from Python API:", error);
    }
    const cached = cacheGet<any[]>("logs");
    if (cached) return NextResponse.json(cached);
    // Return empty array when Python agent is offline
    return NextResponse.json([]);
  }

  // Fallback to Supabase logs (won't reach here due to return above)
  try {
    const supabase = getSupabase();
    if (!supabase) return NextResponse.json([]);
    const sb = supabase!;
    const { data, error } = await sb
      .from("trading_logs")
      .select("id, level, message, data, timestamp")
      .order("timestamp", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e) {
    console.error("Failed to fetch logs from Supabase:", e);
  }

  return NextResponse.json([], { status: 500 });
}

