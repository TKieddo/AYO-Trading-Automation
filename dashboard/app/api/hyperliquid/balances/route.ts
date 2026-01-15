import { NextResponse } from "next/server";
import { getHyperliquidEnv, getHyperliquidBalances } from "@/lib/hyperliquid";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    // Read network directly from env var first (as fallback/verification)
    const networkFromEnv = process.env.HYPERLIQUID_NETWORK?.toLowerCase().trim() || "mainnet";
    
    let env = getHyperliquidEnv();
    if (!env) {
      const missing = [];
      if (!process.env.HYPERLIQUID_WALLET_ADDRESS) {
        missing.push("HYPERLIQUID_WALLET_ADDRESS (your wallet address, 0x...)");
      }
      
      const errorMsg = `Missing Hyperliquid credentials. Please set:\n${missing.join("\n")}\n\n` +
        "Note: Use your MAIN wallet address (the one you logged in with), not the API wallet address.\n" +
        "The API wallet private key is used for trading, but balances are queried from your main wallet.";
      
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Ensure baseUrl matches the env var (fixes Next.js env caching issues)
    const expectedBaseUrl = networkFromEnv === "testnet" 
      ? "https://api.hyperliquid-testnet.xyz" 
      : "https://api.hyperliquid.xyz";
    
    // Override baseUrl if it doesn't match the env var
    if (env.baseUrl !== expectedBaseUrl) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`⚠️ Base URL mismatch: env says ${networkFromEnv} but baseUrl was ${env.baseUrl}. Overriding to ${expectedBaseUrl}`);
      }
      env = { ...env, baseUrl: expectedBaseUrl };
    }

    // Get balances and account state from Hyperliquid
    const { balances, state } = await getHyperliquidBalances(env);
    
    // Network is determined from env var (already processed above)
    const network = networkFromEnv;
    
    // Debug logging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.log(`[Hyperliquid Balances API] Env var: "${process.env.HYPERLIQUID_NETWORK}", Network: ${network}, Base URL: ${env.baseUrl}`);
    }

    // Save balance snapshot to database (non-blocking, async)
    const supabase = getServerSupabase();
    if (supabase) {
      const accountValue = Number(state.accountValue || 0);
      const availableBalance = balances.reduce((sum, b) => sum + Number(b.availableBalance || 0), 0);
      const totalPositionsValue = balances.reduce((sum, b) => sum + Number(b.positionValue || 0), 0);
      const totalUnrealizedPnl = balances.reduce((sum, b) => sum + Number(b.unrealizedPnl || 0), 0);

      // Round timestamp to nearest minute to prevent too many entries
      const now = new Date();
      const roundedTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0);
      
      // Save balance snapshot (fire and forget, don't block response)
      (async () => {
        try {
          await supabase
            .from("wallet_balance_history")
            .upsert({
              account_value: accountValue.toString(),
              available_balance: availableBalance.toString(),
              total_positions_value: totalPositionsValue.toString(),
              unrealized_pnl: totalUnrealizedPnl.toString(),
              network: network,
              timestamp: roundedTimestamp.toISOString(),
            } as any, {
              onConflict: "timestamp,network",
            });
        } catch (err: any) {
          // Log error but don't block the response
          console.error("Error saving balance snapshot:", err);
        }
      })();
    }
    
    // Include raw data for debugging (remove in production)
    const response: any = {
      balances,
      accountValue: state.accountValue,
      withdrawable: state.withdrawable,
      network, // Include network in response so UI knows which one is being used
    };
    
    // Add debug info if no balances found
    if (balances.length === 0) {
      response.debug = {
        rawState: state.rawData,
        accountValue: state.accountValue,
        withdrawable: state.withdrawable,
        assetPositionsCount: state.assetPositions?.length || 0,
      };
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error("Hyperliquid API error:", err);
    return NextResponse.json({ 
      error: err?.message || "Failed to fetch balances",
      details: err?.stack,
    }, { status: 500 });
  }
}

