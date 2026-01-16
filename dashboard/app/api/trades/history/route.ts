import { NextRequest, NextResponse } from "next/server";
import { getHyperliquidEnv, getHyperliquidUserFills } from "@/lib/hyperliquid";
import { getAsterEnv, getAsterUserTrades } from "@/lib/aster";
import { getServerSupabase } from "@/lib/supabase/server";
import crypto from "crypto";

// Removed Binance-specific helper functions

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
}): string {
  // Use trade ID if available, otherwise hash the trade data
  if (trade.tradeId) {
    return `hyperliquid_${trade.tradeId}`;
  }
  const hashInput = `${trade.symbol}_${trade.side}_${trade.size}_${trade.price}_${trade.timestamp}`;
  return crypto.createHash("sha256").update(hashInput).digest("hex").substring(0, 16);
}

/**
 * Fetch all user trades from Supabase first, then sync from Aster API (or Hyperliquid) and save to Supabase.
 * This ensures we always have data even if the API is unavailable.
 * Priority: Aster API > Hyperliquid > Supabase
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    
    // Optional query params
    const searchParams = req.nextUrl.searchParams;
    const forceSync = searchParams.get("forceSync") === "true"; // Force sync from API
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 1000; // API limit

    // Step 1: Fetch existing trades from Supabase
    let supabaseTrades: any[] = [];
    if (sb && !forceSync) {
      try {
        const { data, error } = await sb
          .from("trades")
          .select("*")
          .order("executed_at", { ascending: false })
          .limit(10000); // Get reasonable limit from Supabase
        
        if (!error && Array.isArray(data)) {
          supabaseTrades = data.map((t: any) => ({
            id: t.id || createTradeHash({
              symbol: t.symbol,
              side: t.side,
              size: Number(t.size),
              price: Number(t.price),
              timestamp: t.executed_at,
            }),
            symbol: t.symbol,
            side: t.side,
            size: Number(t.size),
            price: Number(t.price),
            fee: Number(t.fee || 0),
            pnl: t.pnl != null ? Number(t.pnl) : 0,
            timestamp: t.executed_at,
          }));
        }
      } catch (error: any) {
        console.error("Error fetching from Supabase:", error);
      }
    }

    // Step 2: Sync from Aster API (priority) or Hyperliquid API (if credentials available)
    const asterEnv = getAsterEnv();
    const networkFromEnv = process.env.HYPERLIQUID_NETWORK?.toLowerCase().trim() || "mainnet";
    let env = getHyperliquidEnv();
    const asterTrades: any[] = [];
    const hyperliquidTrades: any[] = [];
    const tradesToSave: any[] = [];
    let apiSource = "supabase";
    
    // Priority 1: Try Aster API first (uses same wallet credentials as trading agent)
    if (asterEnv && (forceSync || supabaseTrades.length === 0)) {
      try {
        console.log("Fetching trades from Aster API...");
        // Fetch trades from Aster API using wallet-based authentication
        // Note: Aster API returns up to 1000 trades by default, can paginate with fromId if needed
        const asterApiTrades = await getAsterUserTrades(asterEnv, {
          limit: limit || 1000,
        });
        
        // Map Aster API trade format to our HistoryTrade format
        // Aster API response format based on documentation:
        // { id, symbol, side, price, qty, realizedPnl, commission, time, ... }
        for (const trade of asterApiTrades) {
          const symbol = trade.symbol || "UNKNOWN";
          const side = (trade.side === "BUY" || trade.side === "buy") ? "buy" : "sell";
          const price = Number(trade.price || 0);
          const size = Number(trade.qty || trade.quantity || 0);
          const fee = Number(trade.commission || 0);
          // realizedPnl is the realized profit/loss when position is closed
          const realizedPnl = trade.realizedPnl != null ? Number(trade.realizedPnl) : null;
          
          // Get timestamp (time in milliseconds)
          let executedAt: string;
          if (trade.time) {
            const timeMs = Number(trade.time);
            // Aster API returns time in milliseconds
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
          });
          
          const mappedTrade = {
            id: createTradeHash({
              symbol,
              side,
              size,
              price,
              timestamp: executedAt,
              tradeId: String(tradeId),
            }),
            symbol,
            side: side as "buy" | "sell",
            size: Math.abs(size), // Always positive
            price,
            fee: Math.abs(fee), // Always positive
            // Store PnL: null if not realized, otherwise the actual value (can be 0)
            pnl: realizedPnl !== null ? realizedPnl : null,
            timestamp: executedAt,
          };
          
          asterTrades.push(mappedTrade);
          
          // Prepare for Supabase save
          tradesToSave.push({
            symbol,
            side,
            size: mappedTrade.size,
            price: mappedTrade.price,
            fee: mappedTrade.fee,
            // Store PnL: null if not realized, otherwise the actual value (can be 0)
            pnl: realizedPnl !== null ? realizedPnl : null,
            executed_at: executedAt,
            order_id: trade.orderId ? String(trade.orderId) : null,
          });
        }
        
        apiSource = "aster";
        console.log(`Fetched ${asterTrades.length} trades from Aster API`);
      } catch (error: any) {
        console.error("Error fetching Aster API trades:", error.message || error);
        // Fall through to try Hyperliquid if Aster fails
      }
    }
    
    // Priority 2: Fall back to Hyperliquid API if Aster is not available or failed
    if (asterTrades.length === 0 && env && (forceSync || supabaseTrades.length === 0)) {
      // Ensure baseUrl matches the env var
      const expectedBaseUrl = networkFromEnv === "testnet" 
        ? "https://api.hyperliquid-testnet.xyz" 
        : "https://api.hyperliquid.xyz";
      
      if (env.baseUrl !== expectedBaseUrl) {
        env = { ...env, baseUrl: expectedBaseUrl };
      }

      try {
        // Fetch user fills from Hyperliquid
        const fills = await getHyperliquidUserFills(env, limit);
        
        // Map Hyperliquid fill format to our HistoryTrade format
        for (const fill of fills) {
          // Hyperliquid fill structure: { coin, px, sz, side, time, closedPnl?, fee?, oid? }
          const coin = fill.coin || fill.asset || "UNKNOWN";
          const price = Number(fill.px || fill.price || 0);
          const size = Number(fill.sz || fill.size || 0);
          const isBuy = fill.side === "B" || fill.side === "Buy" || fill.isBuy === true || fill.isBuyer === true;
          const side = isBuy ? "buy" : "sell";
          
          // Get realized PnL (closedPnl in Hyperliquid)
          // closedPnl is only present when a position is closed, representing realized profit/loss
          // If closedPnl is null/undefined, this trade hasn't realized any PnL yet (position still open)
          const realizedPnl = fill.closedPnl != null ? Number(fill.closedPnl) : null;
          
          // Get timestamp (time in milliseconds or timestamp in seconds)
          let executedAt: string;
          if (fill.time) {
            const timeMs = Number(fill.time);
            // If timestamp is in seconds (less than 1e12), convert to milliseconds
            executedAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
          } else if (fill.timestamp) {
            const timeMs = Number(fill.timestamp);
            executedAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
          } else {
            executedAt = new Date().toISOString();
          }
          
          const tradeId = fill.oid || fill.id || createTradeHash({
            symbol: coin,
            side,
            size,
            price,
            timestamp: executedAt,
          });
          
          const mappedTrade = {
            id: createTradeHash({
              symbol: coin,
              side,
              size,
              price,
              timestamp: executedAt,
              tradeId: String(tradeId),
            }),
            symbol: coin,
            side: side as "buy" | "sell",
            size: Math.abs(size), // Always positive
            price,
            fee: fill.fee != null ? Number(fill.fee) : 0,
            // Store PnL: null if not realized, otherwise the actual value (can be 0)
            pnl: realizedPnl !== null ? realizedPnl : null,
            timestamp: executedAt,
          };
          
          hyperliquidTrades.push(mappedTrade);
          
          // Prepare for Supabase save (save all fills, PnL is null if not realized)
          tradesToSave.push({
            symbol: coin,
            side,
            size: mappedTrade.size,
            price: mappedTrade.price,
            fee: mappedTrade.fee,
            // Store PnL: null if not realized (closedPnl is null), otherwise the actual value (can be 0)
            pnl: realizedPnl !== null ? realizedPnl : null,
            executed_at: executedAt,
            order_id: fill.oid ? String(fill.oid) : null,
          });
        }
      } catch (error: any) {
        console.error("Error fetching Hyperliquid fills:", error.message || error);
      }

      // Step 3: Save new trades to Supabase (deduplicate by checking existing)
      if (sb && tradesToSave.length > 0) {
        try {
          // Get existing trades to deduplicate using composite key
          const existingKeys = new Set<string>();
          for (const t of supabaseTrades) {
            const timestamp = new Date(t.timestamp).getTime();
            const roundedPrice = Math.round(Number(t.price) * 10000) / 10000;
            const roundedSize = Math.round(Number(t.size) * 10000) / 10000;
            existingKeys.add(`${t.symbol}_${t.side}_${timestamp}_${roundedPrice}_${roundedSize}`);
          }
          
          const newTrades = tradesToSave.filter((t) => {
            const timestamp = new Date(t.executed_at).getTime();
            const roundedPrice = Math.round(Number(t.price) * 10000) / 10000;
            const roundedSize = Math.round(Number(t.size) * 10000) / 10000;
            const key = `${t.symbol}_${t.side}_${timestamp}_${roundedPrice}_${roundedSize}`;
            return !existingKeys.has(key);
          });

          if (newTrades.length > 0) {
            // Use upsert with conflict resolution on a unique constraint if available
            // For now, use insert but catch duplicate errors
            try {
              await sb.from("trades").insert(newTrades);
            } catch (insertError: any) {
              // If duplicate error, try upsert instead (if table has unique constraint)
              if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
                // Fallback: insert one by one to handle duplicates gracefully
                for (const trade of newTrades) {
                  try {
                    await sb.from("trades").insert(trade).catch(() => {
                      // Ignore individual duplicate errors
                    });
                  } catch {}
                }
              } else {
                throw insertError;
              }
            }
            console.log(`Saved ${newTrades.length} new trades to Supabase`);
            
            // Optionally refresh the wins_losses_stats materialized view for performance
            // This is non-blocking and won't affect the API response
            try {
              await sb.rpc("refresh_wins_losses_stats").catch(() => {
                // Silently fail if the function doesn't exist (older migrations)
              });
            } catch {
              // Ignore errors - materialized view refresh is optional
            }
            
            // Sync trades with PnL to portfolio_activities table
            try {
              const activitiesToSave: any[] = [];
              const now = new Date().toISOString();
              
              for (const trade of newTrades) {
                // Save PnL as trade_pnl activity if it exists
                if (trade.pnl != null) {
                  const pnl = Number(trade.pnl);
                  const tradeId = `${trade.symbol}_${trade.side}_${new Date(trade.executed_at).getTime()}_${trade.price}_${trade.size}`;
                  
                  activitiesToSave.push({
                    type: "trade_pnl",
                    amount: pnl.toString(),
                    symbol: trade.symbol,
                    description: `Trade P&L: ${trade.symbol} ${trade.side}`,
                    timestamp: trade.executed_at,
                    income_id: `trade_pnl_${tradeId}`,
                    synced_at: now,
                  });
                }
                
                // Save fee as commission activity if it exists and > 0
                if (trade.fee != null && Number(trade.fee) > 0) {
                  const fee = Number(trade.fee);
                  const tradeId = `${trade.symbol}_${trade.side}_${new Date(trade.executed_at).getTime()}_${trade.price}_${trade.size}`;
                  
                  activitiesToSave.push({
                    type: "commission",
                    amount: (-fee).toString(), // Negative because it's a cost
                    symbol: trade.symbol,
                    description: `Trading commission: ${trade.symbol} ${trade.side}`,
                    timestamp: trade.executed_at,
                    income_id: `commission_${tradeId}`,
                    synced_at: now,
                  });
                }
              }
              
              if (activitiesToSave.length > 0) {
                const { error } = await sb.from("portfolio_activities").upsert(activitiesToSave as any, {
                  onConflict: "income_id",
                  ignoreDuplicates: false,
                });
                if (error) {
                  console.error("Error syncing trades to portfolio_activities:", error);
                }
                console.log(`Synced ${activitiesToSave.length} trade activities to portfolio_activities`);
              }
            } catch (error: any) {
              console.error("Error syncing trades to portfolio_activities:", error);
            }
            
            // Update account_metrics with latest trade/fee data
            try {
              const { data: allTrades } = await sb
                .from("trades")
                .select("pnl, fee, executed_at")
                .not("pnl", "is", null);
              
              if (allTrades && Array.isArray(allTrades)) {
                const totalPnL = allTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
                const totalFees = allTrades.reduce((sum, t) => sum + (Number(t.fee) || 0), 0);
                
                await sb.from("account_metrics").insert({
                  total_pnl: totalPnL,
                  daily_pnl: 0, // Calculate separately
                  total_trades: allTrades.length,
                  timestamp: new Date().toISOString(),
                }).catch(() => {
                  // Ignore duplicate timestamp errors
                });
              }
            } catch {
              // Ignore errors - metrics update is optional
            }
          }
        } catch (error: any) {
          console.error("Error saving trades to Supabase:", error);
        }
      }
    }

    // Step 4: Combine and merge results with robust deduplication
    // Use composite key for deduplication: symbol + timestamp + price + size + side
    const allTradesMap = new Map<string, any>();
    
    // Helper function to create composite key for deduplication
    const getCompositeKey = (trade: any) => {
      const timestamp = new Date(trade.timestamp).getTime();
      const roundedPrice = Math.round(Number(trade.price) * 10000) / 10000; // Round to 4 decimals
      const roundedSize = Math.round(Number(trade.size) * 10000) / 10000; // Round to 4 decimals
      return `${trade.symbol}_${trade.side}_${timestamp}_${roundedPrice}_${roundedSize}`;
    };
    
    // Add Supabase trades first (older data)
    for (const trade of supabaseTrades) {
      const compositeKey = getCompositeKey(trade);
      // Only add if not already present (deduplicate by composite key)
      if (!allTradesMap.has(compositeKey)) {
        allTradesMap.set(compositeKey, trade);
      }
    }
    
    // Add/overwrite with API trades (Aster first, then Hyperliquid - newer, more accurate data)
    for (const trade of asterTrades) {
      const compositeKey = getCompositeKey(trade);
      // Overwrite if exists (Aster data is most accurate)
      allTradesMap.set(compositeKey, trade);
    }
    
    for (const trade of hyperliquidTrades) {
      const compositeKey = getCompositeKey(trade);
      // Only add if not already present from Aster
      if (!allTradesMap.has(compositeKey)) {
        allTradesMap.set(compositeKey, trade);
      }
    }

    // Convert to array and sort all trades by timestamp (newest first)
    const uniqueTrades = Array.from(allTradesMap.values());
    
    uniqueTrades.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Descending order (newest first)
    });

    return NextResponse.json({ 
      trades: uniqueTrades,
      source: asterTrades.length > 0 ? "aster" : (hyperliquidTrades.length > 0 ? "hyperliquid" : "supabase"),
      synced: asterTrades.length > 0 || hyperliquidTrades.length > 0,
    });
  } catch (error: any) {
    console.error("Error fetching trades history:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch trades history" },
      { status: 500 }
    );
  }
}

