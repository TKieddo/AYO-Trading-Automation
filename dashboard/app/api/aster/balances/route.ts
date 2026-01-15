import { NextResponse } from "next/server";
import { getAsterEnv, asterSignedGet } from "@/lib/aster";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const env = getAsterEnv();
    if (!env) {
      const missing = [];
      if (!process.env.ASTER_USER_ADDRESS) missing.push("ASTER_USER_ADDRESS (main wallet address)");
      if (!process.env.ASTER_SIGNER_ADDRESS) missing.push("ASTER_SIGNER_ADDRESS (API wallet address)");
      if (!process.env.ASTER_PRIVATE_KEY) missing.push("ASTER_PRIVATE_KEY (API wallet private key)");
      
      const errorMsg = `Missing Aster API credentials. Please set:\n${missing.join("\n")}\n\n` +
        "These are wallet addresses and private keys, not traditional API keys.\n" +
        "Find them in your Aster dashboard under API/API Wallet settings.";
      
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Fetch balances, account info, and positions in parallel (matching Python implementation)
    const [balances, account, positions] = await Promise.all([
      asterSignedGet("/fapi/v3/balance", {}, env),
      asterSignedGet("/fapi/v3/account", {}, env).catch((err) => {
        console.error("Failed to fetch Aster account:", err);
        return null;
      }),
      asterSignedGet("/fapi/v3/positionRisk", {}, env).catch((err) => {
        console.error("Failed to fetch Aster positions:", err);
        return [];
      }),
    ]);

    // Normalize shape: asset, balance, available, crossWalletBalance, crossUnPnl
    const mapped = Array.isArray(balances)
      ? balances.map((b: any) => ({
          asset: String(b.asset || b.a || ""),
          walletBalance: Number(b.balance ?? b.wb ?? 0),
          availableBalance: Number(b.availableBalance ?? b.ab ?? 0),
          crossWalletBalance: Number(b.crossWalletBalance ?? b.cw ?? 0),
          crossUnPnl: Number(b.crossUnPnl ?? b.up ?? 0),
        }))
      : [];

    // Calculate account value from account info and positions (matching Python's get_user_state)
    let accountValue = 0;
    let withdrawable = 0;
    let totalUnrealizedPnl = 0;
    
    // Calculate total unrealized PnL from positions (not from balance crossUnPnl)
    // This matches Python: sum(p.get('pnl', 0) for p in enriched_positions)
    const positionsArray = Array.isArray(positions) ? positions : [];
    totalUnrealizedPnl = positionsArray.reduce((sum: number, pos: any) => {
      const positionAmt = Number(pos.positionAmt ?? pos.position_amt ?? 0);
      if (Math.abs(positionAmt) > 0) {
        // Try both camelCase and snake_case field names
        const unrealizedPnl = Number(
          pos.unRealizedProfit ?? 
          pos.unrealized_profit ?? 
          pos.unRealizedPnl ??
          pos.unrealized_pnl ??
          pos.pnl ?? 
          0
        );
        return sum + unrealizedPnl;
      }
      return sum;
    }, 0);
    
    // Calculate total from balance endpoint (sum of all asset balances)
    // This is the sum of all "balance" fields from /fapi/v3/balance endpoint
    const totalBalanceFromBalances = mapped.reduce((sum, b) => sum + Number(b.walletBalance || b.balance || 0), 0);
    
    // Also calculate sum of crossWalletBalance (crossed wallet balance)
    const totalCrossWalletBalance = mapped.reduce((sum, b) => sum + Number(b.crossWalletBalance || 0), 0);
    
    if (account) {
      // Aster account endpoint returns: totalWalletBalance, availableBalance
      // Try both camelCase and snake_case field names (API might return either)
      const totalWalletBalanceFromAccount = Number(
        account.totalWalletBalance ?? 
        account.total_wallet_balance ?? 
        account.totalEquity ??
        account.total_equity ??
        0
      );
      
      // Use the account endpoint's totalWalletBalance if available
      // But also compare with sum of balances to ensure accuracy
      // Total value = total wallet balance + unrealized PnL from positions (matches Python calculation)
      accountValue = totalWalletBalanceFromAccount + totalUnrealizedPnl;
      
      // If account endpoint value seems wrong (less than sum of balances), use sum of balances instead
      // This handles cases where account endpoint might not include all assets
      if (totalWalletBalanceFromAccount > 0 && totalBalanceFromBalances > totalWalletBalanceFromAccount) {
        console.warn("[Aster Balances] Account endpoint totalWalletBalance is less than sum of balances. Using sum of balances instead.");
        accountValue = totalBalanceFromBalances + totalUnrealizedPnl;
      }
      
      withdrawable = Number(
        account.availableBalance ?? 
        account.available_balance ?? 
        0
      );
      
      // Log in development to help debug
      if (process.env.NODE_ENV === "development") {
        console.log("[Aster Balances] Account calculation:", {
          totalWalletBalanceFromAccount,
          totalBalanceFromBalances,
          totalCrossWalletBalance,
          totalUnrealizedPnl,
          accountValue,
          positionsCount: positionsArray.length,
          accountKeys: Object.keys(account),
        });
      }
    } else {
      // Fallback: calculate from balances if account info not available
      // Sum all wallet balances from balance endpoint + unrealized PnL
      console.warn("[Aster Balances] Account endpoint failed, using sum of balances");
      accountValue = totalBalanceFromBalances + totalUnrealizedPnl;
      withdrawable = mapped.reduce((sum, b) => sum + Number(b.availableBalance || 0), 0);
    }

    // Save balance snapshot to database (non-blocking, async)
    const supabase = getServerSupabase();
    if (supabase) {
      const availableBalance = mapped.reduce((sum, b) => sum + Number(b.availableBalance || 0), 0);
      const totalPositionsValue = mapped.reduce((sum, b) => sum + Number(b.crossWalletBalance || 0), 0);

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
              network: "aster", // Use "aster" as network identifier
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

    const response: any = {
      balances: mapped,
      accountValue,
      withdrawable,
    };

    // Always include debug info to help troubleshoot balance issues
    // Note: totalBalanceFromBalances and totalCrossWalletBalance are already calculated above
    response.debug = {
      rawAccount: account,
      accountKeys: account ? Object.keys(account) : [],
      totalWalletBalanceFromAccount: account ? Number(
        account.totalWalletBalance ?? 
        account.total_wallet_balance ?? 
        account.totalEquity ??
        account.total_equity ??
        0
      ) : 0,
      totalBalanceFromBalances, // Sum of all "balance" fields from balance endpoint (calculated above)
      totalCrossWalletBalance, // Sum of all "crossWalletBalance" fields (calculated above)
      positionsCount: positionsArray.length,
      positions: positionsArray.slice(0, 5), // First 5 positions for debugging
      totalUnrealizedPnl,
      accountValue,
      withdrawable,
      balancesCount: balances?.length || 0,
      balances: mapped.map(b => ({
        asset: b.asset,
        walletBalance: b.walletBalance,
        crossWalletBalance: b.crossWalletBalance,
        availableBalance: b.availableBalance,
        crossUnPnl: b.crossUnPnl,
      })),
      calculationMethod: account ? "account_endpoint" : "sum_of_balances",
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error("Aster API error:", err);
    return NextResponse.json({ 
      error: err?.message || "Failed to fetch balances",
      details: err?.stack,
    }, { status: 500 });
  }
}


