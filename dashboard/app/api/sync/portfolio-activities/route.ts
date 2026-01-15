import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Background sync service for portfolio activities
 * Syncs income history, trades, and account value snapshots
 * Can be called via cron or scheduled task
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const results = {
      incomeHistory: { synced: false, count: 0, error: null as string | null },
      trades: { synced: false, count: 0, error: null as string | null },
      accountValue: { synced: false, error: null as string | null },
    };

    // Step 1: Sync income history
    try {
      const baseUrl = req.nextUrl.origin;
      const incomeResponse = await fetch(`${baseUrl}/api/income/history?forceSync=false&limit=1000`, {
        cache: "no-store",
      });

      if (incomeResponse.ok) {
        const incomeData = await incomeResponse.json();
        results.incomeHistory.synced = true;
        results.incomeHistory.count = incomeData.syncedCount || 0;
      } else {
        results.incomeHistory.error = `HTTP ${incomeResponse.status}`;
      }
    } catch (error: any) {
      results.incomeHistory.error = error?.message || "Unknown error";
      console.error("Error syncing income history:", error);
    }

    // Step 2: Sync trades (if needed)
    try {
      const baseUrl = req.nextUrl.origin;
      const tradesResponse = await fetch(`${baseUrl}/api/trades/history?forceSync=false&limit=1000`, {
        cache: "no-store",
      });

      if (tradesResponse.ok) {
        const tradesData = await tradesResponse.json();
        results.trades.synced = true;
        results.trades.count = tradesData.trades?.length || 0;
      } else {
        results.trades.error = `HTTP ${tradesResponse.status}`;
      }
    } catch (error: any) {
      results.trades.error = error?.message || "Unknown error";
      console.error("Error syncing trades:", error);
    }

    // Step 3: Ensure account value snapshot exists (this is handled by balance endpoints)
    // Just verify we have recent snapshots
    try {
      const { data: recentSnapshots, error: snapshotError } = await sb
        .from("wallet_balance_history")
        .select("timestamp")
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!snapshotError && recentSnapshots) {
        results.accountValue.synced = true;
      } else {
        results.accountValue.error = "No recent account value snapshots found";
      }
    } catch (error: any) {
      results.accountValue.error = error?.message || "Unknown error";
      console.error("Error checking account value snapshots:", error);
    }

    const allSynced = results.incomeHistory.synced && results.trades.synced && results.accountValue.synced;

    return NextResponse.json({
      success: allSynced,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error("Error in portfolio activities sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to sync portfolio activities",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Manual sync trigger
 */
export async function POST(req: NextRequest) {
  // Force sync everything
  try {
    const sb = getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const results = {
      incomeHistory: { synced: false, count: 0, error: null as string | null },
      trades: { synced: false, count: 0, error: null as string | null },
    };

    // Force sync income history
    try {
      const baseUrl = req.nextUrl.origin;
      const incomeResponse = await fetch(`${baseUrl}/api/income/history?forceSync=true&limit=1000`, {
        cache: "no-store",
      });

      if (incomeResponse.ok) {
        const incomeData = await incomeResponse.json();
        results.incomeHistory.synced = true;
        results.incomeHistory.count = incomeData.syncedCount || 0;
      } else {
        results.incomeHistory.error = `HTTP ${incomeResponse.status}`;
      }
    } catch (error: any) {
      results.incomeHistory.error = error?.message || "Unknown error";
    }

    // Force sync trades
    try {
      const baseUrl = req.nextUrl.origin;
      const tradesResponse = await fetch(`${baseUrl}/api/trades/history?forceSync=true&limit=1000`, {
        cache: "no-store",
      });

      if (tradesResponse.ok) {
        const tradesData = await tradesResponse.json();
        results.trades.synced = true;
        results.trades.count = tradesData.trades?.length || 0;
      } else {
        results.trades.error = `HTTP ${tradesResponse.status}`;
      }
    } catch (error: any) {
      results.trades.error = error?.message || "Unknown error";
    }

    return NextResponse.json({
      success: results.incomeHistory.synced && results.trades.synced,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to sync portfolio activities",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

