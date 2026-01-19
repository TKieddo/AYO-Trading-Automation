import { NextRequest, NextResponse } from "next/server";
import { getAsterEnv, getAsterIncomeHistory } from "@/lib/aster";
import { getServerSupabase } from "@/lib/supabase/server";

type PortfolioActivityRecord = {
  timestamp: string;
  [key: string]: any;
};

/**
 * Map Aster API income types to our activity types
 */
function mapIncomeType(incomeType: string): string {
  const mapping: Record<string, string> = {
    TRANSFER: "transfer",
    COMMISSION: "commission",
    FUNDING_FEE: "funding_fee",
    REALIZED_PNL: "realized_pnl",
    DEPOSIT: "deposit",
    WITHDRAWAL: "withdrawal",
  };
  
  // If it's REALIZED_PNL, we'll determine if it's profit or loss based on amount
  return mapping[incomeType] || "transfer";
}

/**
 * GET: Fetch income history from Aster API and sync to database
 * POST: Manual sync trigger
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const searchParams = req.nextUrl.searchParams;
    const forceSync = searchParams.get("forceSync") === "true";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 1000;

    // Step 1: Get last sync timestamp from database
    let lastSyncTime: number | null = null;
    if (!forceSync) {
      try {
        const { data: lastActivityData } = await sb
          .from("portfolio_activities")
          .select("timestamp")
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastActivity = lastActivityData as PortfolioActivityRecord | null;
        if (lastActivity?.timestamp) {
          lastSyncTime = new Date(lastActivity.timestamp).getTime();
        }
      } catch (error) {
        console.warn("Error fetching last sync time:", error);
      }
    }

    // Step 2: Fetch from Aster API
    const asterEnv = getAsterEnv();
    if (!asterEnv) {
      // If no Aster credentials, return existing data from database
      const { data: activities, error } = await sb
        .from("portfolio_activities")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return NextResponse.json({
        activities: activities || [],
        synced: false,
        message: "No Aster API credentials available, returning cached data",
      });
    }

    // Calculate time range (last 90 days if no last sync, or since last sync)
    const endTime = Date.now();
    const startTime = lastSyncTime || endTime - 90 * 24 * 60 * 60 * 1000; // 90 days default

    let allIncomeRecords: any[] = [];
    let fromId: number | undefined = undefined;
    let hasMore = true;

    // Paginate through income history
    while (hasMore && allIncomeRecords.length < limit) {
      try {
        const incomeRecords = await getAsterIncomeHistory(asterEnv, {
          startTime,
          endTime,
          limit: Math.min(1000, limit - allIncomeRecords.length),
          ...(fromId ? { fromId } : {}),
        });

        if (!Array.isArray(incomeRecords) || incomeRecords.length === 0) {
          hasMore = false;
          break;
        }

        allIncomeRecords = allIncomeRecords.concat(incomeRecords);

        // Check if we need to paginate (if we got exactly the limit, there might be more)
        if (incomeRecords.length < 1000) {
          hasMore = false;
        } else {
          // Use the last record's ID as fromId for next page
          const lastRecord = incomeRecords[incomeRecords.length - 1];
          fromId = lastRecord.id || lastRecord.tranId;
        }
      } catch (error: any) {
        console.error("Error fetching income history from Aster API:", error);
        // If it's a rate limit, network error, or timeout, break and use what we have
        if (error.message?.includes("429") || 
            error.message?.includes("rate limit") ||
            error.message?.includes("timeout") ||
            error.message?.includes("network error") ||
            error.message?.includes("Unable to connect")) {
          console.warn("Stopping income history fetch due to:", error.message);
          break;
        }
        // For other errors, also break to avoid infinite loops
        console.warn("Stopping income history fetch due to error:", error.message);
        break;
      }
    }

    // Step 3: Map and save to database
    const activitiesToSave: any[] = [];
    const now = new Date().toISOString();

    for (const record of allIncomeRecords) {
      const incomeType = record.incomeType || record.type || "TRANSFER";
      const amount = Number(record.income || record.amount || 0);
      const asset = record.asset || record.symbol || null;
      const time = record.time || record.timestamp;
      const incomeId = record.id || record.tranId || `${incomeType}_${time}_${amount}`;

      // Map income type
      let activityType = mapIncomeType(incomeType);
      
      // For REALIZED_PNL, determine if it's profit or loss based on amount
      if (incomeType === "REALIZED_PNL") {
        activityType = amount >= 0 ? "realized_pnl" : "realized_pnl";
      }

      // Convert timestamp (Aster API uses milliseconds)
      let timestamp: string;
      if (time) {
        const timeMs = Number(time);
        timestamp = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
      } else {
        timestamp = now;
      }

      activitiesToSave.push({
        type: activityType,
        amount: amount.toString(),
        symbol: asset,
        description: record.info || `${incomeType} - ${asset || "N/A"}`,
        timestamp,
        income_id: incomeId,
        synced_at: now,
      });
    }

    // Step 4: Upsert to database (prevent duplicates via income_id)
    // Handle partial unique index by inserting individually
    if (activitiesToSave.length > 0) {
      let successCount = 0;
      for (const activity of activitiesToSave) {
        try {
          const { error } = await sb
            .from("portfolio_activities")
            .upsert(activity as any, {
              onConflict: "income_id",
              ignoreDuplicates: false,
            });
          if (!error) {
            successCount++;
          } else if (error.code !== '23505' && error.code !== '42P10') {
            // Only log non-duplicate errors
            console.error("Error upserting portfolio activity:", error);
          }
        } catch (err: any) {
          // Ignore duplicate errors (23505 is unique constraint violation, 42P10 is constraint mismatch)
          if (err.code !== '23505' && err.code !== '42P10') {
            console.error("Error upserting portfolio activity:", err);
          }
        }
      }
      if (successCount < activitiesToSave.length) {
        console.log(`Synced ${successCount} of ${activitiesToSave.length} activities (some may be duplicates)`);
      }
    }

    // Step 5: Return synced activities
    const { data: syncedActivities, error: fetchError } = await sb
      .from("portfolio_activities")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (fetchError) throw fetchError;

    return NextResponse.json({
      activities: syncedActivities || [],
      synced: true,
      syncedCount: activitiesToSave.length,
      totalCount: syncedActivities?.length || 0,
    });
  } catch (error: any) {
    console.error("Error in income history API:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch income history",
        activities: [],
        synced: false,
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Manual sync trigger
 */
export async function POST(req: NextRequest) {
  // Same logic as GET but always force sync
  const url = new URL(req.url);
  url.searchParams.set("forceSync", "true");
  
  return GET(new NextRequest(url));
}

