import { PortfolioTemplate } from "@/components/portfolio/templates/PortfolioTemplate";
import type { Transaction } from "@/components/portfolio/molecules/TransactionItem";
import type { Asset } from "@/components/portfolio/organisms/AssetsList";
import { headers } from "next/headers";
import { getAsterEnv } from "@/lib/aster";
import { getServerSupabase } from "@/lib/supabase/server";

// Asset name mapping
const ASSET_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "Binance Coin",
  AVAX: "Avalanche",
  DOGE: "Dogecoin",
  XLM: "Stellar",
  ZEC: "Zcash",
  USDC: "USD Coin",
};

async function fetchPortfolioData() {
  // Get base URL - prefer environment variable, fallback to headers
  let base: string;
  try {
    // Try to get from environment variable first (most reliable)
    if (process.env.NEXT_PUBLIC_BASE_URL) {
      base = process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
    } else {
      // Fallback to headers if available
      const h = await headers();
      // Check if headers() returns a Headers-like object
      if (h && typeof h.get === "function") {
        const host = h.get("host") || "localhost:3001";
        const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
        base = `${proto}://${host}`;
      } else {
        // Final fallback
        base = "http://localhost:3001";
      }
    }
  } catch (e) {
    // If headers() fails, use environment variable or default
    base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";
  }

  // Determine which exchange is configured
  const asterEnv = getAsterEnv();
  const binanceEnv = process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET;
  const exchange = asterEnv ? "aster" : (binanceEnv ? "binance" : null);
  
  // Try to fetch portfolio assets from database first
  const supabase = getServerSupabase();
  let assets: Asset[] = [];
  let accountValue = 0;
  let balances: any[] = [];
  
  if (supabase) {
    try {
      // Try to sync portfolio assets first (non-blocking)
      fetch(`${base}/api/portfolio/assets/sync`, {
        method: "POST",
        cache: "no-store",
      }).catch(() => {
        // Silently fail - sync is optional
      });
      
      // Fetch from database
      const { data: assetsData, error: assetsError } = await supabase
        .from("portfolio_assets")
        .select("*")
        .order("holding_value", { ascending: false });
      
      if (!assetsError && assetsData && Array.isArray(assetsData) && assetsData.length > 0) {
        // Filter out summary row and map database format to Asset format
        assets = assetsData
          .filter((a: any) => a.symbol !== '_TOTAL_')
          .map((a: any) => ({
            symbol: a.symbol,
            name: a.name,
            logoUrl: a.logo_url || "",
            price: Number(a.price || 0),
            change24h: Number(a.change_24h || 0),
            holdingQty: Number(a.holding_qty || 0),
            holdingValue: Number(a.holding_value || 0),
          }));
        
        // Get total available balance from summary row if available
        const summaryRow = assetsData.find((a: any) => a.symbol === '_TOTAL_') as any;
        const totalAvailableBalanceFromDb = summaryRow ? Number(summaryRow?.available_balance || 0) : 0;
        
        // Calculate total account value from assets
        accountValue = assets.reduce((sum, a) => sum + a.holdingValue, 0);
        
        // Calculate available balance from balances if we have them, otherwise use from DB
        if (balances.length > 0) {
          const calculatedAvailable = balances.reduce((sum, b) => sum + Number(b.availableBalance || 0), 0);
          // Use calculated if available, otherwise fall back to DB value
          balances = balances.map((b: any) => ({
            ...b,
            availableBalance: b.availableBalance || 0,
          }));
        } else if (totalAvailableBalanceFromDb > 0) {
          // If no balances but we have DB value, create a placeholder
          balances = [{ availableBalance: totalAvailableBalanceFromDb }];
        }
        
        // Fetch balance history and trades (still needed for profit calculations)
        const balanceHistory: any[] = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        let query = supabase
          .from("wallet_balance_history")
          .select("account_value, timestamp")
          .gte("timestamp", thirtyDaysAgo.toISOString());
        
        if (exchange) {
          query = query.eq("network", exchange);
        }
        
        const { data: balanceHistoryData } = await query.order("timestamp", { ascending: true });
        if (balanceHistoryData) {
          balanceHistory.push(...balanceHistoryData);
        }
        
        // Fetch trades for profit calculations
        let trades: any[] = [];
        try {
          const tradesResponse = await fetch(`${base}/api/trades/history`, {
            cache: "no-store",
          });
          if (tradesResponse.ok) {
            const tradesData = await tradesResponse.json();
            trades = tradesData.trades || [];
          }
        } catch (e) {
          console.error("Failed to fetch trades:", e);
        }
        
        // Use available balance from summary row
        if (totalAvailableBalanceFromDb > 0) {
          balances = [{ availableBalance: totalAvailableBalanceFromDb }];
        }
        
        return { assets, balances, accountValue, balanceHistory, exchange, trades };
      }
    } catch (e) {
      console.error("Failed to fetch portfolio assets from database:", e);
      // Fall through to old calculation method
    }
  }
  
  // Fallback to old calculation method if database fetch fails or is empty
  
  // Fetch balances, prices, and balance history in parallel
  // Both Aster and Binance use the Python backend which handles exchange detection
  const balancesEndpoint = exchange === "aster" || exchange === "binance"
    ? `${base}/api/aster/balances`
    : null;
  
  // Fetch balance history from Supabase (last 30 days for month calculation)
  // Filter by network/exchange to get the correct historical data
  let balanceHistory: any[] = [];
  if (supabase) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Build query with network filter if exchange is known
      let query = supabase
        .from("wallet_balance_history")
        .select("account_value, timestamp")
        .gte("timestamp", thirtyDaysAgo.toISOString());
      
      // Filter by network if exchange is configured
      if (exchange) {
        query = query.eq("network", exchange);
      }
      
      const { data, error } = await query
        .order("timestamp", { ascending: true });
      
      if (!error && Array.isArray(data)) {
        balanceHistory = data;
      }
    } catch (e) {
      console.error("Failed to fetch balance history from Supabase:", e);
    }
  }

  const [balancesRes, pricesRes] = await Promise.all([
    balancesEndpoint ? fetch(balancesEndpoint, { cache: "no-store" }) : Promise.resolve(new Response(JSON.stringify({ balances: [], error: "No exchange configured" }), { status: 400 })),
    fetch(`${base}/api/prices`, { cache: "no-store" }),
  ]);

  let prices: any[] = [];
  // balances, accountValue, and balanceHistory are already declared above

  try {
    const balancesData = await balancesRes.json();
    if (balancesRes.ok && !balancesData.error) {
      balances = balancesData.balances || [];
      // Use accountValue from API (same as wallet page)
      accountValue = Number(balancesData.accountValue || 0);
    }
  } catch (e) {
    console.error("Failed to fetch balances:", e);
  }

  try {
    // Check if response is ok before parsing JSON
    if (pricesRes.ok) {
      try {
        prices = await pricesRes.json();
        if (!Array.isArray(prices)) prices = [];
      } catch (jsonError: any) {
        // If JSON parsing fails (empty response, invalid JSON, etc.), default to empty array
        console.warn("Prices response is not valid JSON:", jsonError.message);
        prices = [];
      }
    } else {
      prices = [];
    }
  } catch (e) {
    console.error("Failed to fetch prices:", e);
    prices = [];
  }

  // Balance history is already fetched from Supabase above

  // Try to get historical prices from Supabase to calculate 24h change if API doesn't provide it
  let historicalPricesMap: Map<string, { price: number; timestamp: string }[]> = new Map();
  if (supabase) {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const { data: histData } = await supabase
        .from("prices")
        .select("symbol, price, timestamp")
        .gte("timestamp", oneDayAgo.toISOString())
        .order("timestamp", { ascending: false });
      
      if (histData && Array.isArray(histData)) {
        for (const h of histData as any[]) {
          const sym = String(h?.symbol || "").toUpperCase();
          if (sym) {
            if (!historicalPricesMap.has(sym)) {
              historicalPricesMap.set(sym, []);
            }
            const price = Number(h.price || 0);
            if (price > 0) {
              historicalPricesMap.get(sym)!.push({
                price: price,
                timestamp: h.timestamp,
              });
            }
          }
        }
      }
    } catch (e) {
      // Silently fail - historical prices are optional
    }
  }

  // Create a price lookup map
  const priceMap = new Map<string, { price: number; change24h: number }>();
  for (const p of prices) {
    const symbol = String(p.symbol || "").toUpperCase();
    if (symbol) {
      // Prefer change24hPercent, fallback to change24h
      let rawChange24h = Number(p.change24hPercent ?? p.change24h ?? 0);
      
      // If API doesn't provide change24h or it's 0, try to calculate from historical prices
      if ((rawChange24h === 0 || isNaN(rawChange24h)) && historicalPricesMap.has(symbol)) {
        const currentPrice = Number(p.price || 0);
        const histPrices = historicalPricesMap.get(symbol)!;
        
        if (currentPrice > 0 && histPrices.length > 0) {
          // Find price from ~24 hours ago (closest to 24h)
          const now = Date.now();
          const targetTime = now - 24 * 60 * 60 * 1000;
          let closestHistPrice: { price: number; timestamp: string } | null = null;
          let minDiff = Infinity;
          
          for (const hist of histPrices) {
            const histTime = new Date(hist.timestamp).getTime();
            const diff = Math.abs(histTime - targetTime);
            // Only consider prices from the past (not future)
            if (diff < minDiff && histTime < now && histTime <= targetTime + 2 * 60 * 60 * 1000) {
              minDiff = diff;
              closestHistPrice = hist;
            }
          }
          
          // Calculate 24h change if we found historical price
          if (closestHistPrice && closestHistPrice.price > 0) {
            rawChange24h = ((currentPrice - closestHistPrice.price) / closestHistPrice.price) * 100;
          }
        }
      }
      
      // Ensure the value is a valid number (not NaN or Infinity)
      const change24h = (rawChange24h != null && !isNaN(rawChange24h) && isFinite(rawChange24h)) 
        ? rawChange24h 
        : 0;
      
      const rawPrice = Number(p.price || 0);
      const price = (rawPrice != null && !isNaN(rawPrice) && isFinite(rawPrice)) 
        ? rawPrice 
        : 0;
      
      priceMap.set(symbol, {
        price: price,
        change24h: change24h, // This will be used for asset 24h change display
      });
    }
  }

  // Convert balances to Asset format - show all balances (like wallet page)
  // Filter to only show assets with meaningful balances (exclude very small/zero balances)
  // IMPORTANT: Binance returns balances in native asset units (BTC in BTC, USDT in USDT, etc.)
  // We need to convert each to USD for proper totaling
  assets = balances
    .filter((b) => {
      // Show asset if Balance/Position is greater than a meaningful threshold
      // Use a threshold of $0.01 USD equivalent to filter out dust/rounding errors
      const balancePosition = Number(b.positionValue || b.crossWalletBalance || b.walletBalance || 0);
      const asset = String(b.asset || "").toUpperCase();
      
      // For stablecoins, check if balance > $0.01
      if (asset === "USDT" || asset === "USDC") {
        return balancePosition > 0.01;
      }
      
      // For crypto assets, we need to convert to USD first to check threshold
      const priceInfo = priceMap.get(asset) || { price: 0 };
      if (priceInfo.price > 0) {
        const usdValue = balancePosition * priceInfo.price;
        return usdValue > 0.01; // Only show if USD value > $0.01
      }
      
      // If no price available, use native balance threshold (very small)
      return balancePosition > 1e-8;
    })
    .map((b) => {
      const asset = String(b.asset || "").toUpperCase();
      const priceInfo = priceMap.get(asset) || { price: 0, change24h: 0 };
      
      // Ensure price and change24h are valid numbers
      const validPrice = (priceInfo.price != null && !isNaN(priceInfo.price) && isFinite(priceInfo.price)) 
        ? priceInfo.price 
        : 0;
      const validChange24h = (priceInfo.change24h != null && !isNaN(priceInfo.change24h) && isFinite(priceInfo.change24h)) 
        ? priceInfo.change24h 
        : 0;
      
      // Get balance in native asset units (from Binance API)
      // For Binance: crossWalletBalance/walletBalance is in the asset's native unit
      const balanceNative = Number(b.positionValue || b.crossWalletBalance || b.walletBalance || 0);
      const availableBalance = Number(b.availableBalance || 0);
      
      // Calculate holding quantity and USD value
      let holdingQty = 0;
      let holdingValueUSD = 0;
      
      if (asset === "USDT" || asset === "USDC") {
        // Stablecoins: 1:1 with USD, so balance is already in USD
        holdingQty = balanceNative;
        holdingValueUSD = balanceNative;
      } else {
        // Crypto assets: balance is in native units (e.g., BTC), need to convert to USD
        holdingQty = balanceNative; // Quantity in native asset
        if (validPrice > 0) {
          // Convert to USD: quantity * price
          holdingValueUSD = balanceNative * validPrice;
        } else {
          // If no price available, we can't convert - use 0
          holdingValueUSD = 0;
        }
      }

      return {
        symbol: asset,
        name: ASSET_NAMES[asset] || asset,
        logoUrl: `https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop`, // Placeholder
        price: validPrice,
        change24h: validChange24h,
        holdingQty: Math.abs(holdingQty),
        holdingValue: Math.abs(holdingValueUSD), // Value in USD (converted from native units)
      };
    })
    .sort((a, b) => b.holdingValue - a.holdingValue); // Sort by value descending

  // Fetch trades to calculate net profit
  let trades: any[] = [];
  try {
    const tradesResponse = await fetch(`${base}/api/trades/history`, {
      cache: "no-store",
    });
    if (tradesResponse.ok) {
      const tradesData = await tradesResponse.json();
      trades = tradesData.trades || [];
      
      // Debug: Log trade statistics
      const tradesWithPnl = trades.filter(t => t.pnl != null && !isNaN(Number(t.pnl)));
      if (process.env.NODE_ENV === "development") {
        console.log(`[Portfolio] Fetched ${trades.length} total trades, ${tradesWithPnl.length} with PnL`);
      }
    }
  } catch (e) {
    console.error("Failed to fetch trades:", e);
  }

  // Return with assets calculated from balances/prices (fallback method)
  return { assets, balances, accountValue, balanceHistory, exchange, trades, priceMap };
}

/**
 * Calculate percentage change between current balance and historical balance
 * Handles edge cases: null, NaN, Infinity, zero values
 */
function calculatePercentageChange(current: number, historical: number | null): number {
  // Ensure current is a valid number
  const validCurrent = (current != null && !isNaN(current) && isFinite(current)) ? current : 0;
  
  // If no historical data or historical is 0, return 0 (no change to calculate)
  if (!historical || historical === 0 || isNaN(historical) || !isFinite(historical)) {
    return 0;
  }
  
  // Calculate percentage change
  const change = ((validCurrent - historical) / historical) * 100;
  
  // Ensure result is valid
  return (change != null && !isNaN(change) && isFinite(change)) ? change : 0;
}


// Demo transactions (can be replaced with real transaction data later)
const demoTransactions: Transaction[] = [
  { id: "1", title: "Binance", subtitle: "Trade", avatarUrl: "https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop", amount: 428.0 },
  { id: "2", title: "Position Closed", subtitle: "Trade", avatarUrl: "https://images.unsplash.com/photo-1517059224940-d4af9eec41e5?w=80&q=80&auto=format&fit=crop", amount: -124.55 },
  { id: "3", title: "Aster", subtitle: "Trade", avatarUrl: "https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop", amount: 5710.2 },
];

// Force dynamic rendering - this page needs real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PortfolioPage() {
  const { assets, balances, accountValue, balanceHistory, exchange, trades, priceMap } = await fetchPortfolioData();
  
  // Calculate total available balance (funds available for trading)
  const totalAvailableBalance = balances.reduce((sum, b) => sum + Number(b.availableBalance || 0), 0);
  
  // Calculate total wallet balance - sum of ALL assets converted to USD
  // This should include BTC, USDT, USDC, and all other assets
  let totalWalletBalance: number;
  
  // Always calculate total from assets array (most accurate - includes all assets converted to USD)
  // The assets array has holdingValue already converted to USD for each asset
  if (assets.length > 0) {
    totalWalletBalance = assets.reduce((sum, a) => sum + a.holdingValue, 0);
    
    // Use accountValue from API as a sanity check, but prefer the sum of assets
    // accountValue might only include USDT or might be calculated differently
    if (accountValue != null && accountValue > 0) {
      // If accountValue is significantly different, log a warning but use our calculation
      const diff = Math.abs(totalWalletBalance - accountValue);
      const diffPercent = (diff / accountValue) * 100;
      if (diffPercent > 5) {
        // More than 5% difference - might indicate an issue
        console.warn(`Total calculation mismatch: assets sum=${totalWalletBalance}, accountValue=${accountValue}, diff=${diffPercent.toFixed(2)}%`);
      }
      // Still use our calculation (sum of assets) as it includes all assets
    }
  } else {
    // Fallback: Use accountValue if no assets available
    if (accountValue != null && accountValue > 0) {
      totalWalletBalance = accountValue;
    } else {
      // Last resort: Try to sum balances directly (but need to convert to USD)
      totalWalletBalance = balances.reduce((acc: number, b: any) => {
        const asset = String(b.asset || "").toUpperCase();
        const balanceNative = Number(b.positionValue || b.crossWalletBalance || b.walletBalance || 0);
        
        if (asset === "USDT" || asset === "USDC") {
          // Stablecoins: already in USD
          return acc + balanceNative;
        } else {
          // Crypto: convert to USD using price
          const priceInfo = priceMap?.get(asset) || { price: 0 };
          if (priceInfo.price > 0) {
            return acc + (balanceNative * priceInfo.price);
          }
          return acc; // Skip if no price available
        }
      }, 0);
    }
  }
  
  const totalValueFormatted = `$${totalWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const availableBalanceFormatted = `$${totalAvailableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // Calculate percentage changes - ensure all values are valid numbers
  const validTotalBalance = (totalWalletBalance != null && !isNaN(totalWalletBalance) && isFinite(totalWalletBalance)) 
    ? totalWalletBalance 
    : 0;
  
  // Filter trades by period and calculate profit percentage for each period
  const now = Date.now();
  const oneDayAgoMs = now - 24 * 60 * 60 * 1000;
  const oneWeekAgoMs = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgoMs = now - 30 * 24 * 60 * 60 * 1000;
  
  // Filter trades for each period
  const dayTrades = trades.filter(t => {
    const tradeTime = new Date(t.timestamp || t.executed_at).getTime();
    return tradeTime >= oneDayAgoMs;
  });
  
  const weekTrades = trades.filter(t => {
    const tradeTime = new Date(t.timestamp || t.executed_at).getTime();
    return tradeTime >= oneWeekAgoMs;
  });
  
  const monthTrades = trades.filter(t => {
    const tradeTime = new Date(t.timestamp || t.executed_at).getTime();
    return tradeTime >= oneMonthAgoMs;
  });
  
  // Calculate profit for each period
  const calculatePeriodProfit = (periodTrades: any[]) => {
    // Only count trades with valid PnL (not null/undefined)
    const tradesWithPnl = periodTrades.filter(t => t.pnl != null && !isNaN(Number(t.pnl)));
    
    if (tradesWithPnl.length === 0) {
      return 0; // No trades with PnL in this period
    }
    
    const periodPnL = tradesWithPnl.reduce((sum, t) => {
      const pnl = Number(t.pnl);
      return sum + (pnl != null && !isNaN(pnl) && isFinite(pnl) ? pnl : 0);
    }, 0);
    
    const periodFees = periodTrades.reduce((sum, t) => {
      const fee = t.fee != null && !isNaN(Number(t.fee)) ? Number(t.fee) : 0;
      return sum + (fee != null && !isNaN(fee) && isFinite(fee) ? fee : 0);
    }, 0);
    
    const netProfit = periodPnL - periodFees;
    
    // Return 0 if the result is effectively zero (handles -0 case)
    return Math.abs(netProfit) < 0.0001 ? 0 : netProfit;
  };
  
  const dayProfit = calculatePeriodProfit(dayTrades);
  const weekProfit = calculatePeriodProfit(weekTrades);
  const monthProfit = calculatePeriodProfit(monthTrades);
  
  // Calculate profit percentage for each period relative to total balance
  // Only calculate if we have valid balance and profit
  const calculateProfitPercent = (profit: number): number => {
    if (validTotalBalance <= 0) return 0;
    if (profit == null || isNaN(profit) || !isFinite(profit)) return 0;
    
    const percent = (profit / validTotalBalance) * 100;
    
    // Return 0 if percentage is effectively zero (handles -0 case)
    return Math.abs(percent) < 0.001 ? 0 : percent;
  };
  
  const dayChangePercent = calculateProfitPercent(dayProfit);
  const weekChangePercent = calculateProfitPercent(weekProfit);
  const monthChangePercent = calculateProfitPercent(monthProfit);
  
  // Calculate all-time net profit from all trades (for main delta)
  const totalPnL = trades.reduce((sum, t) => {
    const pnl = t.pnl != null && !isNaN(Number(t.pnl)) ? Number(t.pnl) : 0;
    return sum + pnl;
  }, 0);
  
  const totalFees = trades.reduce((sum, t) => {
    const fee = t.fee != null && !isNaN(Number(t.fee)) ? Number(t.fee) : 0;
    return sum + fee;
  }, 0);
  
  const netProfit = totalPnL - totalFees; // Net profit after fees
  
  // Calculate profit as percentage of total balance
  // Delta shows all-time profit percentage relative to total balance
  // Formula: (Net Profit / Total Balance) * 100
  // Net Profit = Total PnL from all trades - Total Fees
  const profitPercent = (validTotalBalance > 0 && netProfit != null && !isNaN(netProfit) && isFinite(netProfit))
    ? (netProfit / validTotalBalance) * 100
    : 0;
  
  const deltaValue = (profitPercent != null && !isNaN(profitPercent) && isFinite(profitPercent))
    ? profitPercent
    : 0;
  const deltaFormatted = deltaValue >= 0 ? `+${deltaValue.toFixed(2)}%` : `${deltaValue.toFixed(2)}%`;
  
  // Format percentage changes for display (handle null/NaN/Infinity values)
  const formatPercent = (value: number | null): number => {
    if (value == null || isNaN(value) || !isFinite(value)) return 0;
    return value;
  };

  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
        <div className="h-full w-full bg-[radial-gradient(900px_500px_at_15%_-10%,#FEF9C3_0%,transparent_45%),radial-gradient(800px_450px_at_85%_0%,#ECFCCB_0%,transparent_48%),radial-gradient(700px_400px_at_10%_85%,#FEF9C3_0%,transparent_50%),radial-gradient(700px_400px_at_90%_85%,#ECFCCB_0%,transparent_50%),radial-gradient(600px_350px_at_50%_40%,#FFF7B3_0%,transparent_55%)]" />
      </div>
      <PortfolioTemplate 
        transactions={demoTransactions} 
        assets={assets}
        totalValue={totalValueFormatted}
        availableBalance={availableBalanceFormatted}
        delta={deltaFormatted}
        deltaValue={deltaValue}
        dayChange={formatPercent(dayChangePercent)}
        weekChange={formatPercent(weekChangePercent)}
        monthChange={formatPercent(monthChangePercent)}
      />
    </div>
  );
}


