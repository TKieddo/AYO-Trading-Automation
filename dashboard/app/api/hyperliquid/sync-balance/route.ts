import { NextResponse } from "next/server";
import { getHyperliquidEnv, getHyperliquidBalances } from "@/lib/hyperliquid";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Sync Hyperliquid wallet balance to database
 * This endpoint should be called periodically (e.g., every 5 minutes) to track balance history
 */
export async function POST() {
  try {
    // Read network directly from env var
    const networkFromEnv = process.env.HYPERLIQUID_NETWORK?.toLowerCase().trim() || "mainnet";
    
    let env = getHyperliquidEnv();
    if (!env) {
      return NextResponse.json({ error: "Hyperliquid credentials not configured" }, { status: 400 });
    }

    // Ensure baseUrl matches the env var
    const expectedBaseUrl = networkFromEnv === "testnet" 
      ? "https://api.hyperliquid-testnet.xyz" 
      : "https://api.hyperliquid.xyz";
    
    if (env.baseUrl !== expectedBaseUrl) {
      env = { ...env, baseUrl: expectedBaseUrl };
    }

    // Get current balances from Hyperliquid
    const { balances, state } = await getHyperliquidBalances(env);
    
    // Calculate totals
    const accountValue = Number(state.accountValue || 0);
    const availableBalance = balances.reduce((sum, b) => sum + Number(b.availableBalance || 0), 0);
    const totalPositionsValue = balances.reduce((sum, b) => sum + Number(b.positionValue || 0), 0);
    const totalUnrealizedPnl = balances.reduce((sum, b) => sum + Number(b.unrealizedPnl || 0), 0);

    // Save to database
    const supabase = getServerSupabase();
    if (supabase) {
      // Use upsert with timestamp to prevent duplicates (based on UNIQUE constraint)
      const now = new Date();
      // Round timestamp to nearest minute to prevent too many entries
      const roundedTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0);
      
      const { error } = await supabase
        .from("wallet_balance_history")
        .upsert({
          account_value: accountValue.toString(),
          available_balance: availableBalance.toString(),
          total_positions_value: totalPositionsValue.toString(),
          unrealized_pnl: totalUnrealizedPnl.toString(),
          network: networkFromEnv,
          timestamp: roundedTimestamp.toISOString(),
        } as any, {
          onConflict: "timestamp,network",
        });

      if (error) {
        console.error("Error saving balance to database:", error);
        // Continue even if DB save fails - API should still work
      }
    }

    return NextResponse.json({
      success: true,
      accountValue,
      availableBalance,
      totalPositionsValue,
      totalUnrealizedPnl,
      network: networkFromEnv,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Hyperliquid sync error:", err);
    return NextResponse.json({ 
      error: err?.message || "Failed to sync balance",
    }, { status: 500 });
  }
}

/**
 * Get balance history for percentage calculations
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network") || process.env.HYPERLIQUID_NETWORK || "mainnet";
    const hours = parseInt(searchParams.get("hours") || "168"); // Default 7 days (168 hours)

    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Get recent balance history
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("wallet_balance_history")
      .select("*")
      .eq("network", network)
      .gte("timestamp", cutoffTime)
      .order("timestamp", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      history: data || [],
      network,
    });
  } catch (err: any) {
    console.error("Error fetching balance history:", err);
    return NextResponse.json({ 
      error: err?.message || "Failed to fetch balance history",
    }, { status: 500 });
  }
}

