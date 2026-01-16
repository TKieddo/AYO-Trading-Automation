import { PortfolioTemplate } from "@/components/portfolio/templates/PortfolioTemplate";
import type { Transaction } from "@/components/portfolio/molecules/TransactionItem";
import type { Asset } from "@/components/portfolio/organisms/AssetsList";
import { headers } from "next/headers";
import { getAsterEnv } from "@/lib/aster";
import { getHyperliquidEnv } from "@/lib/hyperliquid";

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

  // Determine which exchange is configured (Aster takes priority)
  const asterEnv = getAsterEnv();
  const hyperliquidEnv = getHyperliquidEnv();
  const exchange = asterEnv ? "aster" : (hyperliquidEnv ? "hyperliquid" : null);
  
  // Fetch balances, prices, and balance history in parallel
  const network = process.env.HYPERLIQUID_NETWORK || "mainnet";
  const balancesEndpoint = exchange === "aster" 
    ? `${base}/api/aster/balances`
    : exchange === "hyperliquid"
    ? `${base}/api/hyperliquid/balances`
    : null;
  
  // Note: Aster sync-balance endpoint may not exist yet, so we'll handle errors gracefully
  const balanceHistoryEndpoint = exchange === "hyperliquid"
    ? `${base}/api/hyperliquid/sync-balance?network=${network}&hours=720`
    : null; // Aster balance history can be queried directly from Supabase if needed

  const [balancesRes, pricesRes, balanceHistoryRes] = await Promise.all([
    balancesEndpoint ? fetch(balancesEndpoint, { cache: "no-store" }) : Promise.resolve(new Response(JSON.stringify({ balances: [], error: "No exchange configured" }), { status: 400 })),
    fetch(`${base}/api/prices`, { cache: "no-store" }),
    balanceHistoryEndpoint ? fetch(balanceHistoryEndpoint, { cache: "no-store" }) : Promise.resolve(new Response(JSON.stringify({ history: [] }), { status: 200 })),
  ]);

  let balances: any[] = [];
  let prices: any[] = [];
  let accountValue = 0;
  let balanceHistory: any[] = [];

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
    prices = await pricesRes.json();
    if (!Array.isArray(prices)) prices = [];
  } catch (e) {
    console.error("Failed to fetch prices:", e);
  }

  try {
    const historyData = await balanceHistoryRes.json();
    if (balanceHistoryRes.ok && historyData.history) {
      balanceHistory = Array.isArray(historyData.history) ? historyData.history : [];
    }
  } catch (e) {
    console.error("Failed to fetch balance history:", e);
  }

  // Create a price lookup map
  const priceMap = new Map<string, { price: number; change24h: number }>();
  for (const p of prices) {
    const symbol = String(p.symbol || "").toUpperCase();
    if (symbol) {
      priceMap.set(symbol, {
        price: Number(p.price || 0),
        change24h: Number(p.change24hPercent || p.change24h || 0),
      });
    }
  }

  // Convert balances to Asset format - show all balances (like wallet page)
  // Filter to only show assets with Balance/Position > 0 (same logic as wallet page)
  const assets: Asset[] = balances
    .filter((b) => {
      // Show asset if Balance/Position is greater than 0 (same as wallet page)
      const balancePosition = Number(b.positionValue || b.crossWalletBalance || b.walletBalance || 0);
      return balancePosition > 0;
    })
    .map((b) => {
      const asset = String(b.asset || "").toUpperCase();
      const priceInfo = priceMap.get(asset) || { price: 0, change24h: 0 };
      
      // Use Balance/Position value (same calculation as wallet page)
      const balancePosition = Number(b.positionValue || b.crossWalletBalance || b.walletBalance || 0);
      const availableBalance = Number(b.availableBalance || 0);
      
      // Calculate holding quantity from balance position and price
      let holdingQty = 0;
      if (asset === "USDC") {
        holdingQty = balancePosition;
      } else {
        // For other assets, calculate quantity from balance position and price
        if (priceInfo.price > 0) {
          holdingQty = balancePosition / priceInfo.price;
        }
      }

      // Use balance position as the holding value (total balance including positions)
      const holdingValue = balancePosition;

      return {
        symbol: asset,
        name: ASSET_NAMES[asset] || asset,
        logoUrl: `https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop`, // Placeholder
        price: priceInfo.price,
        change24h: priceInfo.change24h,
        holdingQty: Math.abs(holdingQty),
        holdingValue: Math.abs(holdingValue),
      };
    })
    .sort((a, b) => b.holdingValue - a.holdingValue); // Sort by value descending

  return { assets, balances, accountValue, balanceHistory, exchange };
}

/**
 * Calculate percentage change between current balance and historical balance
 */
function calculatePercentageChange(current: number, historical: number | null): number {
  if (!historical || historical === 0) return 0;
  return ((current - historical) / historical) * 100;
}


// Demo transactions (can be replaced with real transaction data later)
const demoTransactions: Transaction[] = [
  { id: "1", title: "Hyperliquid", subtitle: "Trade", avatarUrl: "https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop", amount: 428.0 },
  { id: "2", title: "Position Closed", subtitle: "Trade", avatarUrl: "https://images.unsplash.com/photo-1517059224940-d4af9eec41e5?w=80&q=80&auto=format&fit=crop", amount: -124.55 },
  { id: "3", title: "Hyperliquid", subtitle: "Trade", avatarUrl: "https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop", amount: 5710.2 },
];

export default async function PortfolioPage() {
  const { assets, balances, accountValue, balanceHistory, exchange } = await fetchPortfolioData();
  
  // Calculate total available balance (funds available for trading)
  const totalAvailableBalance = balances.reduce((sum, b) => sum + Number(b.availableBalance || 0), 0);
  
  // Calculate total wallet balance (same logic as wallet page)
  let totalWalletBalance: number;
  if (accountValue != null && accountValue > 0) {
    // Use accountValue from API if available (preferred for both exchanges)
    totalWalletBalance = accountValue;
  } else if (exchange === "aster") {
    // Fallback for Aster: sum crossWalletBalance from all balances (includes unrealized PnL)
    totalWalletBalance = balances.reduce((acc: number, b: any) => acc + (Number(b.crossWalletBalance || b.walletBalance || 0) || 0), 0);
  } else {
    // Fallback for Hyperliquid: sum position values
    totalWalletBalance = balances.reduce((acc: number, b: any) => acc + (Number(b.walletBalance || b.positionValue) || 0), 0);
  }
  
  const totalValueFormatted = `$${totalWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const availableBalanceFormatted = `$${totalAvailableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // Calculate real percentage changes from historical data
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  // Find historical balances (closest match to target time)
  const findClosestBalance = (targetTime: number, maxHoursDiff: number = 12) => {
    const maxDiff = maxHoursDiff * 60 * 60 * 1000;
    let closest: any = null;
    let minDiff = Infinity;
    
    for (const h of balanceHistory) {
      const timestamp = new Date(h.timestamp).getTime();
      const diff = Math.abs(timestamp - targetTime);
      if (diff <= maxDiff && diff < minDiff) {
        minDiff = diff;
        closest = h;
      }
    }
    return closest;
  };
  
  const dayBalance = findClosestBalance(oneDayAgo, 2); // Within 2 hours
  const weekBalance = findClosestBalance(oneWeekAgo, 6); // Within 6 hours
  const monthBalance = findClosestBalance(oneMonthAgo, 12); // Within 12 hours
  
  // Calculate percentage changes
  const dayChangePercent = calculatePercentageChange(
    totalWalletBalance,
    dayBalance ? Number(dayBalance.account_value || 0) : null
  );
  const weekChangePercent = calculatePercentageChange(
    totalWalletBalance,
    weekBalance ? Number(weekBalance.account_value || 0) : null
  );
  const monthChangePercent = calculatePercentageChange(
    totalWalletBalance,
    monthBalance ? Number(monthBalance.account_value || 0) : null
  );
  
  // Delta shows 24h change as percentage
  const deltaValue = dayChangePercent;
  const deltaFormatted = deltaValue >= 0 ? `+${deltaValue.toFixed(1)}%` : `${deltaValue.toFixed(1)}%`;

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
        dayChange={dayChangePercent}
        weekChange={weekChangePercent}
        monthChange={monthChangePercent}
      />
    </div>
  );
}


