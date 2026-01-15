import { NextResponse } from "next/server";
import { getHyperliquidEnv, getHyperliquidBalances } from "@/lib/hyperliquid";
import { getServerSupabase } from "@/lib/supabase/server";

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET() {
  // First, try to get balances from Python backend (preferred - no credentials needed in Vercel)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${PYTHON_API_URL}/status`, {
      signal: controller.signal,
      cache: "no-store",
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const statusData = await response.json();
      
      // Also try to get positions for more detailed balance info
      try {
        const positionsResponse = await fetch(`${PYTHON_API_URL}/positions`, {
          cache: "no-store",
        });
        
        if (positionsResponse.ok) {
          const positions = await positionsResponse.json();
          
          // Calculate total unrealized PnL
          const totalUnrealizedPnl = positions.reduce((sum: number, p: any) => 
            sum + (Number(p.unrealized_pnl || p.pnl || 0)), 0
          );
          
          // Return balance info from Python backend
          return NextResponse.json({
            balances: [],
            accountValue: statusData.account_value || statusData.balance || 0,
            withdrawable: statusData.balance || 0,
            totalUnrealizedPnl: totalUnrealizedPnl,
            positions: positions.length,
            exchange: statusData.exchange || "hyperliquid",
            network: statusData.network || statusData.network_label || "mainnet",
            source: "python_backend"
          });
        }
      } catch (e) {
        // Fall through to status-only response
      }
      
      // Return basic balance from status
      return NextResponse.json({
        balances: [],
        accountValue: statusData.account_value || statusData.balance || 0,
        withdrawable: statusData.balance || 0,
        positions: statusData.positions_count || 0,
        exchange: statusData.exchange || "hyperliquid",
        network: statusData.network || statusData.network_label || "mainnet",
        source: "python_backend"
      });
    }
  } catch (error: any) {
    // Python backend not available, fallback to direct API call
    if (error.code !== 'ECONNREFUSED' && !error.message?.includes('fetch failed')) {
      console.log("Python backend not available, trying direct API call");
    }
  }
  
  // Fallback: Direct API call (requires credentials in Vercel - not recommended for production)
  try {
    // Read network directly from env var first (as fallback/verification)
    const networkFromEnv = process.env.HYPERLIQUID_NETWORK?.toLowerCase().trim() || "mainnet";
    
    let env = getHyperliquidEnv();
    if (!env) {
      return NextResponse.json({ 
        error: "Python backend not available and Hyperliquid credentials not configured. Please ensure your Python trading agent is running.",
        hint: "Start your Python agent with: poetry run python src/main.py"
      }, { status: 503 });
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

