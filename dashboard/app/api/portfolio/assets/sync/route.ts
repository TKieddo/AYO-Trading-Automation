import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAsterEnv } from "@/lib/aster";

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
  USDT: "Tether",
};

/**
 * Sync portfolio assets from exchange API to database
 * This endpoint fetches balances, prices, and calculates all asset data
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Get base URL
    const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || 
                 process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || 
                 "http://localhost:3001";

    // Determine which exchange is configured
    const asterEnv = getAsterEnv();
    const binanceEnv = process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET;
    const exchange = asterEnv ? "aster" : (binanceEnv ? "binance" : null);

    if (!exchange) {
      return NextResponse.json({ error: "No exchange configured" }, { status: 400 });
    }

    // Fetch balances and prices in parallel
    const balancesEndpoint = `${base}/api/aster/balances`;
    const [balancesRes, pricesRes] = await Promise.all([
      fetch(balancesEndpoint, { cache: "no-store" }),
      fetch(`${base}/api/prices`, { cache: "no-store" }),
    ]);

    let balances: any[] = [];
    let prices: any[] = [];
    let accountValue = 0;

    try {
      const balancesData = await balancesRes.json();
      if (balancesRes.ok && !balancesData.error) {
        balances = balancesData.balances || [];
        accountValue = Number(balancesData.accountValue || 0);
      }
    } catch (e) {
      console.error("Failed to fetch balances:", e);
    }

    try {
      if (pricesRes.ok) {
        prices = await pricesRes.json();
        if (!Array.isArray(prices)) prices = [];
      }
    } catch (e) {
      console.error("Failed to fetch prices:", e);
      prices = [];
    }

    // Create price lookup map
    const priceMap = new Map<string, { price: number; change24h: number }>();
    for (const p of prices) {
      const symbol = String(p.symbol || "").toUpperCase();
      if (symbol) {
        const rawChange24h = Number(p.change24hPercent ?? p.change24h ?? 0);
        const change24h = (rawChange24h != null && !isNaN(rawChange24h) && isFinite(rawChange24h)) 
          ? rawChange24h 
          : 0;
        
        const rawPrice = Number(p.price || 0);
        const price = (rawPrice != null && !isNaN(rawPrice) && isFinite(rawPrice)) 
          ? rawPrice 
          : 0;
        
        priceMap.set(symbol, { price, change24h });
      }
    }

    // Try to get historical prices for 24h change calculation if missing
    let historicalPricesMap: Map<string, { price: number; timestamp: string }[]> = new Map();
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const { data: histData } = await supabase
        .from("prices")
        .select("symbol, price, timestamp")
        .gte("timestamp", oneDayAgo.toISOString())
        .order("timestamp", { ascending: false });
      
      if (histData && Array.isArray(histData)) {
        for (const h of histData) {
          const sym = String(h.symbol || "").toUpperCase();
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

    // Calculate total portfolio value
    const assets: Array<{
      symbol: string;
      name: string;
      logoUrl: string;
      price: number;
      change24h: number;
      holdingQty: number;
      holdingValue: number;
    }> = [];

    // Process balances and convert to assets
    for (const b of balances) {
      const asset = String(b.asset || "").toUpperCase();
      const balanceNative = Number(b.positionValue || b.crossWalletBalance || b.walletBalance || 0);
      
      // Skip very small balances
      if (asset === "USDT" || asset === "USDC") {
        if (balanceNative <= 0.01) continue;
      } else {
        const priceInfo = priceMap.get(asset) || { price: 0 };
        if (priceInfo.price > 0) {
          const usdValue = balanceNative * priceInfo.price;
          if (usdValue <= 0.01) continue;
        } else if (balanceNative <= 1e-8) {
          continue;
        }
      }

      const priceInfo = priceMap.get(asset) || { price: 0, change24h: 0 };
      let validPrice = priceInfo.price;
      let validChange24h = priceInfo.change24h;

      // Calculate 24h change from historical if missing
      if ((validChange24h === 0 || isNaN(validChange24h)) && historicalPricesMap.has(asset)) {
        const histPrices = historicalPricesMap.get(asset)!;
        if (validPrice > 0 && histPrices.length > 0) {
          const now = Date.now();
          const targetTime = now - 24 * 60 * 60 * 1000;
          let closestHistPrice: { price: number; timestamp: string } | null = null;
          let minDiff = Infinity;
          
          for (const hist of histPrices) {
            const histTime = new Date(hist.timestamp).getTime();
            const diff = Math.abs(histTime - targetTime);
            if (diff < minDiff && histTime < now && histTime <= targetTime + 2 * 60 * 60 * 1000) {
              minDiff = diff;
              closestHistPrice = hist;
            }
          }
          
          if (closestHistPrice && closestHistPrice.price > 0) {
            validChange24h = ((validPrice - closestHistPrice.price) / closestHistPrice.price) * 100;
          }
        }
      }

      // Calculate holding quantity and USD value
      let holdingQty = 0;
      let holdingValueUSD = 0;
      
      if (asset === "USDT" || asset === "USDC") {
        holdingQty = balanceNative;
        holdingValueUSD = balanceNative;
      } else {
        holdingQty = balanceNative;
        if (validPrice > 0) {
          holdingValueUSD = balanceNative * validPrice;
        }
      }

      assets.push({
        symbol: asset,
        name: ASSET_NAMES[asset] || asset,
        logoUrl: `https://images.unsplash.com/photo-1621416894569-0f39d0c3f3a1?w=80&q=80&auto=format&fit=crop`,
        price: validPrice,
        change24h: validChange24h,
        holdingQty: Math.abs(holdingQty),
        holdingValue: Math.abs(holdingValueUSD),
      });
    }

    // Sort by holding value descending
    assets.sort((a, b) => b.holdingValue - a.holdingValue);

    // Calculate total available balance from balances
    const totalAvailableBalance = balances.reduce((sum, b) => sum + Number(b.availableBalance || 0), 0);

    // Upsert assets to database
    const assetsToUpsert = assets.map(a => {
      // Find matching balance to get available balance for this asset
      const matchingBalance = balances.find(b => String(b.asset || "").toUpperCase() === a.symbol);
      const assetAvailableBalance = matchingBalance ? Number(matchingBalance.availableBalance || 0) : 0;
      
      return {
        symbol: a.symbol,
        name: a.name,
        logo_url: a.logoUrl,
        price: a.price,
        change_24h: a.change24h,
        holding_qty: a.holdingQty,
        holding_value: a.holdingValue,
        available_balance: assetAvailableBalance,
        updated_at: new Date().toISOString(),
      };
    });
    
    // Also store total available balance in a summary row (using special symbol)
    // This allows us to quickly get total available balance without summing
    const totalAccountValue = assets.reduce((sum, a) => sum + a.holdingValue, 0);
    assetsToUpsert.push({
      symbol: '_TOTAL_',
      name: 'Portfolio Summary',
      logo_url: null,
      price: 0,
      change_24h: 0,
      holding_qty: 0,
      holding_value: totalAccountValue,
      available_balance: totalAvailableBalance,
      updated_at: new Date().toISOString(),
    });

    const { error: upsertError } = await supabase
      .from("portfolio_assets")
      .upsert(assetsToUpsert, {
        onConflict: "symbol",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("Failed to upsert portfolio assets:", upsertError);
      return NextResponse.json(
        { error: "Failed to save portfolio assets", details: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      synced: assets.length,
      assets: assets,
    });
  } catch (error: any) {
    console.error("Error syncing portfolio assets:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync portfolio assets" },
      { status: 500 }
    );
  }
}
