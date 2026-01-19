import { NextRequest, NextResponse } from "next/server";
import { getAsterEnv, getAsterUserTrades } from "@/lib/aster";
import { getBinanceEnv, getBinanceUserTradesForSymbol } from "@/lib/binance";
import { getServerSupabase } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * Create a unique hash for a trade to use for deduplication
 */
function createTradeHash(trade: {
  symbol: string;
  side: string;
  size: number;
  price: number;
  timestamp: string;
  tradeId?: string | number;
  exchange?: string;
}): string {
  // Use trade ID if available, otherwise hash the trade data
  const exchangePrefix = trade.exchange || "aster";
  if (trade.tradeId) {
    return `${exchangePrefix}_${trade.tradeId}`;
  }
  const hashInput = `${exchangePrefix}_${trade.symbol}_${trade.side}_${trade.size}_${trade.price}_${trade.timestamp}`;
  return crypto.createHash("sha256").update(hashInput).digest("hex").substring(0, 16);
}

/**
 * Detect which exchanges are configured based on environment variables
 * Returns an object with flags for each exchange
 */
function getConfiguredExchanges(): { aster: boolean; binance: boolean } {
  // Check for Aster credentials
  const hasAster = !!(process.env.ASTER_USER_ADDRESS && process.env.ASTER_PRIVATE_KEY);
  // Check for Binance credentials
  const hasBinance = !!(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
  
  return { aster: hasAster, binance: hasBinance };
}

/**
 * Fetch all user trades from Supabase database first, then sync from Python backend/API.
 * Priority: Supabase (database) > Python Backend > Direct API
 */
export async function GET(req: NextRequest) {
  try {
    // Optional query params
    const searchParams = req.nextUrl.searchParams;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 1000; // API limit

    let dbTrades: any[] = [];
    let apiTrades: any[] = [];
    let sources: string[] = [];
    
    // Step 1: Fetch from Supabase database first (if available)
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        console.log(`[Trades History] Fetching from Supabase database...`);
        const { data: supabaseTrades, error } = await supabase
          .from("trades")
          .select("*")
          .order("executed_at", { ascending: false })
          .limit(10000); // Get reasonable limit from database
        
        if (!error && Array.isArray(supabaseTrades)) {
          // Map Supabase trades to HistoryTrade format
          const mappedDbTrades = supabaseTrades.map((t: any) => ({
            id: t.id || createTradeHash({
              symbol: t.symbol,
              side: t.side,
              size: Number(t.size),
              price: Number(t.price),
              timestamp: t.executed_at,
            }),
            symbol: t.symbol,
            side: t.side,
            size: Number(t.size || 0),
            price: Number(t.price || 0),
            fee: Number(t.fee || 0),
            pnl: t.pnl != null && !isNaN(Number(t.pnl)) ? Number(t.pnl) : null,
            timestamp: t.executed_at,
          }));
          
          dbTrades = mappedDbTrades;
          sources.push("supabase");
          console.log(`✅ Fetched ${mappedDbTrades.length} trades from Supabase database`);
        } else if (error) {
          console.warn(`⚠️ Error fetching from Supabase: ${error.message}`);
        }
      } catch (error: any) {
        console.warn(`⚠️ Supabase fetch failed: ${error.message}`);
      }
    } else {
      console.log(`[Trades History] Supabase not configured, skipping database fetch`);
    }

    // Step 2: Fetch fresh trades from Python backend/API to merge with database
    const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    
    console.log(`[Trades History] Fetching fresh trades from Python backend API: ${pythonApiUrl}/api/trades`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch(`${pythonApiUrl}/api/trades?limit=${limit}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.trades && Array.isArray(data.trades)) {
          apiTrades = data.trades;
          sources.push("python-backend");
          console.log(`✅ Fetched ${apiTrades.length} trades from Python backend`);
        } else {
          console.warn("Python backend returned invalid trades data:", data);
        }
      } else {
        const errorText = await response.text().catch(() => "");
        // Don't log 404 as error if it's just the Next.js 404 page
        if (response.status === 404 && errorText.includes("<!DOCTYPE html>")) {
          console.log(`Python backend endpoint not available (404), falling back to direct API`);
        } else {
          console.warn(`Python backend returned error ${response.status}: ${errorText.substring(0, 200)}`);
        }
      }
    } catch (error: any) {
      // Don't log timeout errors as warnings - they're expected if Python agent is slow
      if (error.name === "AbortError" || error.message?.includes("aborted")) {
        console.log(`Python backend request timed out, falling back to direct API`);
      } else {
        console.warn(`Failed to fetch from Python backend: ${error.message}`);
      }
      // Fall back to direct Binance API calls
      console.log(`[Trades History] Falling back to direct Binance API calls`);
      
      // Fetch from Exchange APIs (Aster and/or Binance) - fetch from both if configured
    const exchanges = getConfiguredExchanges();
    const asterEnv = getAsterEnv();
      
    console.log(`[Trades History] Configured exchanges:`, exchanges);
    
      // Try Aster API if configured
      if (exchanges.aster && asterEnv) {
        try {
          console.log("Fetching trades from Aster API...");
          const asterApiTrades = await getAsterUserTrades(asterEnv, {
            limit: limit || 1000,
          });
          
          // Map Aster API trade format to our HistoryTrade format
          for (const trade of asterApiTrades) {
            const symbol = trade.symbol || "UNKNOWN";
            const side = (trade.side === "BUY" || trade.side === "buy") ? "buy" : "sell";
            const price = Number(trade.price || 0);
            const size = Number(trade.qty || trade.quantity || 0);
            const fee = Number(trade.commission || 0);
            const realizedPnl = trade.realizedPnl != null ? Number(trade.realizedPnl) : null;
            
            let executedAt: string;
            if (trade.time) {
              const timeMs = Number(trade.time);
              executedAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
            } else {
              executedAt = new Date().toISOString();
            }
            
            const tradeId = trade.id || trade.tradeId || createTradeHash({
              symbol,
              side,
              size,
              price,
              timestamp: executedAt,
              exchange: "aster",
            });
            
            const mappedTrade = {
              id: createTradeHash({
                symbol,
                side,
                size,
                price,
                timestamp: executedAt,
                tradeId: String(tradeId),
                exchange: "aster",
              }),
              symbol,
              side: side as "buy" | "sell",
              size: Math.abs(size),
              price,
              fee: Math.abs(fee),
              pnl: realizedPnl !== null ? realizedPnl : null,
              timestamp: executedAt,
            };
            
            apiTrades.push(mappedTrade);
          }
          
          sources.push("aster");
        console.log(`✅ Fetched ${asterApiTrades.length} trades from Aster API`);
        } catch (error: any) {
          // Log detailed error but don't fail the entire request
          // Binance trades can still be fetched even if Aster fails
          const errorMessage = error.message || error.toString() || "Unknown error";
          console.error("Error fetching Aster API trades:", errorMessage);
          
          // Check if it's a configuration issue vs network issue
          if (errorMessage.includes("network error") || errorMessage.includes("timeout")) {
            console.warn("Aster API appears to be unreachable. This may be a network issue or the API is down.");
          } else if (errorMessage.includes("authentication") || errorMessage.includes("signature")) {
            console.warn("Aster API authentication failed. Check your ASTER_USER_ADDRESS, ASTER_SIGNER_ADDRESS, and ASTER_PRIVATE_KEY environment variables.");
          }
        }
      }
      
      // Try Binance API if configured
      // Binance fetching is independent - it will run even if Aster fails
      console.log(`[Trades History] Checking Binance: exchanges.binance=${exchanges.binance}`);
      if (exchanges.binance) {
        try {
          const binanceEnv = getBinanceEnv();
          console.log(`[Trades History] Binance env check: ${binanceEnv ? 'credentials found' : 'credentials missing'}`);
          if (binanceEnv) {
            console.log("🔄 Fetching trades from Binance API...");
            
            // Get trading symbols - try to fetch from Python backend status, or use common ones
            let tradingSymbols = ["BTC", "ETH", "SOL", "BNB", "DOGE", "ZEC", "AVAX", "XLM"]; // Default fallback
            try {
              // Try to get assets from Python backend status
            const pythonApiUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";
              const statusRes = await fetch(`${pythonApiUrl}/status`, { 
                cache: "no-store",
                signal: AbortSignal.timeout(5000) // 5 second timeout
              });
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                // Python backend might have assets in status
                if (statusData.assets && Array.isArray(statusData.assets)) {
                  tradingSymbols = statusData.assets.map((a: string) => a.toUpperCase());
                  console.log(`Using trading symbols from Python backend: ${tradingSymbols.join(", ")}`);
                }
              }
            } catch (error: any) {
              // Fallback to default symbols if Python backend unavailable
              console.log(`Using default trading symbols: ${tradingSymbols.join(", ")}`);
            }
            
          // Calculate time range - fetch last 30 days (will paginate in 7-day chunks)
            const endTime = Date.now();
          const daysToFetch = 30;
            const startTime = endTime - (daysToFetch * 24 * 60 * 60 * 1000);
            
          const allSymbolsToFetch = Array.from(new Set(tradingSymbols.map(s => s.toUpperCase())));
            
            console.log(`Fetching Binance trades for ${allSymbolsToFetch.length} symbols: ${allSymbolsToFetch.join(", ")}`);
            
            // Fetch trades for each symbol (Binance API requires symbol parameter)
            const binanceTrades: any[] = [];
            for (const asset of allSymbolsToFetch) {
              try {
                // Binance limitation: max 7 days per request
                  // Fetch in 7-day chunks
                  let currentStartTime = startTime;
                  const chunkSize = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
                  
                  while (currentStartTime < endTime) {
                    const chunkEndTime = Math.min(currentStartTime + chunkSize, endTime);
                    try {
                      const trades = await getBinanceUserTradesForSymbol(
                        binanceEnv,
                        asset,
                        {
                          startTime: currentStartTime,
                          endTime: chunkEndTime,
                          limit: 1000, // Binance max is 1000
                        }
                      );
                      binanceTrades.push(...trades);
                      // Move to next chunk
                      currentStartTime = chunkEndTime + 1; // +1 to avoid overlap
                  
                  // Small delay to avoid rate limits
                  await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (chunkError: any) {
                      console.warn(`Error fetching Binance trades for ${asset} (chunk ${new Date(currentStartTime).toISOString()}):`, chunkError.message || chunkError);
                      // Continue with next chunk
                      currentStartTime = chunkEndTime + 1;
                    }
                }
              } catch (error: any) {
                // Skip symbols that don't exist or have no trades
                if (error.message?.includes("Invalid symbol") || error.message?.includes("400")) {
                  console.log(`No trades or invalid symbol for ${asset}, skipping...`);
                } else {
                  console.warn(`Error fetching Binance trades for ${asset}:`, error.message || error);
                }
                // Continue with other symbols
              }
            }
            
            // Map Binance API trade format to our HistoryTrade format
            for (const trade of binanceTrades) {
              const symbol = trade.symbol ? trade.symbol.replace("USDT", "") : "UNKNOWN";
              const side = (trade.side === "BUY" || trade.side === "buy") ? "buy" : "sell";
              const price = Number(trade.price || 0);
              const size = Number(trade.qty || trade.quantity || 0);
              const fee = Number(trade.commission || 0);
              // Binance provides realizedPnl for closed positions
              const realizedPnl = trade.realizedPnl != null && trade.realizedPnl !== "" 
                ? Number(trade.realizedPnl) 
                : null;
              
              let executedAt: string;
              if (trade.time) {
                const timeMs = Number(trade.time);
                executedAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
              } else {
                executedAt = new Date().toISOString();
              }
              
              const tradeId = trade.id || trade.orderId || createTradeHash({
                symbol,
                side,
                size,
                price,
                timestamp: executedAt,
                exchange: "binance",
              });
              
              const mappedTrade = {
                id: createTradeHash({
                  symbol,
                  side,
                  size,
                  price,
                  timestamp: executedAt,
                  tradeId: String(tradeId),
                  exchange: "binance",
                }),
                symbol,
                side: side as "buy" | "sell",
                size: Math.abs(size),
                price,
                fee: Math.abs(fee),
                pnl: realizedPnl !== null ? realizedPnl : null, // Include realized PnL from Binance
                timestamp: executedAt,
              };
              
              apiTrades.push(mappedTrade);
            }
            
            sources.push("binance");
            console.log(`✅ Fetched ${binanceTrades.length} trades from Binance API`);
          } else {
            console.warn("⚠️ Binance credentials not available in environment variables (BINANCE_API_KEY and BINANCE_API_SECRET required)");
          }
        } catch (error: any) {
          // Log detailed error but don't fail the entire request
          const errorMessage = error.message || error.toString() || "Unknown error";
          console.error("❌ Error fetching Binance API trades:", errorMessage);
          
          // Provide helpful error context
          if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
            console.warn("⚠️ Binance API authentication failed. Check your BINANCE_API_KEY and BINANCE_API_SECRET.");
          } else if (errorMessage.includes("network error") || errorMessage.includes("timeout") || errorMessage.includes("fetch failed")) {
            console.warn("⚠️ Binance API network error. Check your internet connection and that https://fapi.binance.com is accessible.");
          } else if (errorMessage.includes("Invalid symbol")) {
            console.warn("⚠️ Some Binance symbols may be invalid. This is normal if you're not trading all symbols.");
          }
        }
      } else {
        console.log("ℹ️ Binance not configured (BINANCE_API_KEY and BINANCE_API_SECRET not set)");
        console.log(`[Trades History] Binance check: BINANCE_API_KEY=${!!process.env.BINANCE_API_KEY}, BINANCE_API_SECRET=${!!process.env.BINANCE_API_SECRET}`);
      }
    }

    // Step 3: Merge database and API trades with deduplication
    const allTradesMap = new Map<string, any>();
    
    // Helper function to create composite key for deduplication
    const getCompositeKey = (trade: any) => {
      const timestamp = new Date(trade.timestamp).getTime();
      const roundedPrice = Math.round(Number(trade.price) * 10000) / 10000; // Round to 4 decimals
      const roundedSize = Math.round(Number(trade.size) * 10000) / 10000; // Round to 4 decimals
      return `${trade.symbol}_${trade.side}_${timestamp}_${roundedPrice}_${roundedSize}`;
    };
    
    // Add database trades first (older/historical data)
    for (const trade of dbTrades) {
      const compositeKey = getCompositeKey(trade);
      allTradesMap.set(compositeKey, trade);
    }
    
    // Add/overwrite with API trades (newer, more accurate data)
    for (const trade of apiTrades) {
      const compositeKey = getCompositeKey(trade);
      // Overwrite if exists (API data is more recent/accurate)
      allTradesMap.set(compositeKey, trade);
    }

    // Convert to array and sort all trades by timestamp (newest first)
    const uniqueTrades = Array.from(allTradesMap.values());
    
    uniqueTrades.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Descending order (newest first)
    });

    // Always return trades array, even if empty
    // This ensures the frontend receives a valid response
    return NextResponse.json({ 
      trades: uniqueTrades || [],
      source: sources.length > 0 ? sources.join(",") : "none",
      synced: apiTrades.length > 0,
      count: uniqueTrades.length,
    });
  } catch (error: any) {
    console.error("Error fetching trades history:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch trades history", trades: [] },
      { status: 500 }
    );
  }
}
