import { NextRequest, NextResponse } from "next/server";
import { getAsterEnv, getAsterOpenOrders } from "@/lib/aster";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Fetch all open orders from Aster and sync to Supabase.
 * Uses Aster API openOrders endpoint.
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

    // Step 2: Fetch open orders from Aster API
    let env = getAsterEnv();
    const asterOrders: any[] = [];
    const ordersToSave: any[] = [];
    
    if (env) {
      try {
        const orders = await getAsterOpenOrders(env, symbol ? { symbol } : {});
        
        if (!Array.isArray(orders)) {
          throw new Error("Invalid response from Aster API");
        }

        // Map Aster order format to our HistoryOrder format
        for (const o of orders) {
          const coin = o.symbol || o.asset || "UNKNOWN";
          
          // Filter by symbol if specified
          if (symbol && coin !== symbol) continue;
          
          const side = o.side?.toLowerCase() === "buy" ? "buy" : "sell";
          const orderType: "market" | "limit" = o.type?.toLowerCase() === "limit" ? "limit" : "market";
          
          const orderId = String(o.orderId || o.id || "");
          const price = o.price != null ? Number(o.price) : undefined;
          const size = Number(o.origQty || o.size || 0);
          
          // Get timestamp
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
          
          asterOrders.push(mappedOrder);
          
          // Prepare for Supabase save
          ordersToSave.push({
            order_id: orderId,
            symbol: coin,
            side,
            type: orderType,
            size: mappedOrder.size,
            price: mappedOrder.price,
            status: "open",
            filled_size: 0,
            created_at: createdAt,
            updated_at: createdAt,
          });
        }
      } catch (error: any) {
        console.error("Error fetching open orders from Aster:", error);
        // If Aster fails, return Supabase data if available
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
          await sb.from("orders").upsert(ordersToSave as any, {
            onConflict: "order_id",
          });
          console.log(`Saved/updated ${ordersToSave.length} open orders to Supabase`);
        } catch (error: any) {
          console.error("Error saving orders to Supabase:", error);
        }
      }
    }

    // Step 4: Mark closed orders as canceled/filled in Supabase
    if (sb && asterOrders.length > 0 && supabaseOrders.length > 0) {
      try {
        const asterOrderIds = new Set(asterOrders.map(o => o.id));
        const closedOrders = supabaseOrders
          .filter(o => !asterOrderIds.has(o.id))
          .map(o => o.id);
        
        if (closedOrders.length > 0) {
          const updateData: any = { 
            status: "filled",
            updated_at: new Date().toISOString(),
          };
          const query = sb.from("orders") as any;
          await query.update(updateData).in("order_id", closedOrders);
          console.log(`Marked ${closedOrders.length} orders as filled`);
        }
      } catch (error: any) {
        console.error("Error updating closed orders:", error);
      }
    }

    // Step 5: Combine and return results (prioritize Aster if available)
    const allOrders = asterOrders.length > 0 ? asterOrders : supabaseOrders;
    
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
      source: asterOrders.length > 0 ? "aster" : "supabase",
      synced: asterOrders.length > 0,
    });
  } catch (error: any) {
    console.error("Error fetching open orders:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch open orders" },
      { status: 500 }
    );
  }
}

