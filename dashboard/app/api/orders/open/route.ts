import { NextRequest, NextResponse } from "next/server";
import { getHyperliquidEnv, getHyperliquidOpenOrders } from "@/lib/hyperliquid";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Fetch all open orders from Hyperliquid and sync to Supabase.
 * Uses Hyperliquid Info API frontendOpenOrders endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    
    // Optional query params
    const searchParams = req.nextUrl.searchParams;
    const forceSync = searchParams.get("forceSync") === "true";
    const symbol = searchParams.get("symbol"); // Optional: fetch for specific symbol only

    // Step 1: Fetch existing open orders from Supabase
    let supabaseOrders: any[] = [];
    if (sb && !forceSync) {
      try {
        const query = sb
          .from("orders")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false });
        
        if (symbol) {
          query.eq("symbol", symbol);
        }
        
        const { data, error } = await query;
        
        if (!error && Array.isArray(data)) {
          supabaseOrders = data.map((o: any) => ({
            id: o.id || String(o.order_id),
            symbol: o.symbol,
            side: o.side,
            type: o.type || "market",
            size: Number(o.size || 0),
            price: o.price != null ? Number(o.price) : undefined,
            status: o.status === "open" ? "open" : (o.status === "filled" ? "filled" : "canceled"),
            createdAt: o.created_at,
            updatedAt: o.updated_at,
          }));
        }
      } catch (error: any) {
        console.error("Error fetching from Supabase:", error);
      }
    }

    // Step 2: Fetch open orders from Hyperliquid API
    const networkFromEnv = process.env.HYPERLIQUID_NETWORK?.toLowerCase().trim() || "mainnet";
    let env = getHyperliquidEnv();
    const hyperliquidOrders: any[] = [];
    const ordersToSave: any[] = [];
    
    if (env) {
      // Ensure baseUrl matches the env var
      const expectedBaseUrl = networkFromEnv === "testnet" 
        ? "https://api.hyperliquid-testnet.xyz" 
        : "https://api.hyperliquid.xyz";
      
      if (env.baseUrl !== expectedBaseUrl) {
        env = { ...env, baseUrl: expectedBaseUrl };
      }

      try {
        const orders = await getHyperliquidOpenOrders(env);
        
        if (!Array.isArray(orders)) {
          throw new Error("Invalid response from Hyperliquid API");
        }

        // Map Hyperliquid order format to our HistoryOrder format
        for (const o of orders) {
          const coin = o.coin || o.asset || "UNKNOWN";
          
          // Filter by symbol if specified
          if (symbol && coin !== symbol) continue;
          
          const isBuy = o.isBuy === true || o.side === "B" || o.side === "Buy";
          const side = isBuy ? "buy" : "sell";
          
          // Determine order type from Hyperliquid format
          let orderType: "market" | "limit" = "market";
          const orderTypeRaw = o.orderType;
          if (typeof orderTypeRaw === "string") {
            if (orderTypeRaw.toLowerCase().includes("limit")) {
              orderType = "limit";
            }
          } else if (typeof orderTypeRaw === "object" && orderTypeRaw) {
            if ("limit" in orderTypeRaw || "limitPx" in orderTypeRaw) {
              orderType = "limit";
            }
          }
          
          const orderId = String(o.oid || o.id || "");
          const price = o.px != null ? Number(o.px) : (orderType === "limit" && o.limitPx ? Number(o.limitPx) : undefined);
          const size = Number(o.sz || o.size || 0);
          
          // Get timestamp (use current time for open orders, or time if available)
          let createdAt: string;
          if (o.time) {
            const timeMs = Number(o.time);
            createdAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
          } else {
            createdAt = new Date().toISOString();
          }
          
          // Format for frontend
          const mappedOrder = {
            id: orderId,
            symbol: coin,
            side: side as "buy" | "sell",
            type: orderType,
            size: Math.abs(size),
            price: price && price > 0 ? price : undefined,
            status: "open" as const,
            createdAt,
            updatedAt: createdAt,
          };
          
          hyperliquidOrders.push(mappedOrder);
          
          // Prepare for Supabase save
          ordersToSave.push({
            order_id: orderId,
            symbol: coin,
            side,
            type: orderType,
            size: mappedOrder.size,
            price: mappedOrder.price,
            status: "open",
            filled_size: 0, // Open orders haven't been filled yet
            created_at: createdAt,
            updated_at: createdAt,
          });
        }
      } catch (error: any) {
        console.error("Error fetching open orders from Hyperliquid:", error);
        // If Hyperliquid fails, return Supabase data if available
        if (supabaseOrders.length > 0) {
          return NextResponse.json({
            orders: supabaseOrders,
            source: "supabase",
            synced: false,
            error: error.message,
          });
        }
        throw error;
      }

      // Step 3: Save/Update orders to Supabase
      if (sb && ordersToSave.length > 0) {
        try {
          // Upsert orders by order_id (update if exists, insert if new)
          await sb.from("orders").upsert(ordersToSave, {
            onConflict: "order_id",
          });
          console.log(`Saved/updated ${ordersToSave.length} open orders to Supabase`);
        } catch (error: any) {
          console.error("Error saving orders to Supabase:", error);
        }
      }
    }

    // Step 4: Mark closed orders as canceled/filled in Supabase
    // If an order was in Supabase but not in Hyperliquid response, it might have been filled/canceled
    if (sb && hyperliquidOrders.length > 0 && supabaseOrders.length > 0) {
      try {
        const hyperliquidOrderIds = new Set(hyperliquidOrders.map(o => o.id));
        const closedOrders = supabaseOrders
          .filter(o => !hyperliquidOrderIds.has(o.id))
          .map(o => o.id);
        
        if (closedOrders.length > 0) {
          // Update status to filled (assume filled if not in open orders)
          await sb
            .from("orders")
            .update({ 
              status: "filled",
              updated_at: new Date().toISOString(),
            })
            .in("order_id", closedOrders);
          console.log(`Marked ${closedOrders.length} orders as filled`);
        }
      } catch (error: any) {
        console.error("Error updating closed orders:", error);
      }
    }

    // Step 5: Combine and return results (prioritize Hyperliquid if available)
    const allOrders = hyperliquidOrders.length > 0 ? hyperliquidOrders : supabaseOrders;
    
    // Remove duplicates and sort by created_at (newest first)
    const uniqueOrders = Array.from(
      new Map(allOrders.map(o => [o.id, o])).values()
    );
    
    uniqueOrders.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA; // Descending order (newest first)
    });

    return NextResponse.json({
      orders: uniqueOrders,
      source: hyperliquidOrders.length > 0 ? "hyperliquid" : "supabase",
      synced: hyperliquidOrders.length > 0,
    });
  } catch (error: any) {
    console.error("Error fetching open orders:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch open orders" },
      { status: 500 }
    );
  }
}

