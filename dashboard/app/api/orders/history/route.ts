import { NextRequest, NextResponse } from "next/server";
import { getAsterEnv, getAsterAllOrders } from "@/lib/aster";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Fetch ALL orders (open, filled, canceled, etc.) from Aster API (priority) or Binance for history.
 * Priority: Exchange API > Supabase
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();

    // Optional query params
    const searchParams = req.nextUrl.searchParams;
    const forceSync = searchParams.get("forceSync") === "true";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 1000;

    // Step 1: Always fetch existing orders from Supabase first (contains data from all exchanges)
    // Supabase is the source of truth - it contains orders from both Aster and Binance
    let supabaseOrders: any[] = [];
    if (sb) {
      try {
        const query = sb
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10000); // Get reasonable limit from Supabase
        
        const { data, error } = await query;
        
        if (!error && Array.isArray(data)) {
          supabaseOrders = data.map((o: any) => ({
            id: o.id || String(o.order_id),
            symbol: o.symbol,
            side: o.side,
            type: o.type || "market",
            size: Number(o.size || 0),
            price: o.price != null ? Number(o.price) : undefined,
            status: o.status,
            createdAt: o.created_at,
            updatedAt: o.updated_at,
          }));
          console.log(`Fetched ${supabaseOrders.length} orders from Supabase (includes all exchanges)`);
        }
      } catch (error: any) {
        console.error("Error fetching from Supabase:", error);
      }
    }

    // Step 2: Optionally sync fresh data from Exchange APIs (if forceSync or no Supabase data)
    // This updates Supabase with latest data, but Supabase is always the primary source
    const asterEnv = getAsterEnv();
    const hasBinance = !!(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
    const apiOrders: any[] = [];
    const ordersToSave: any[] = [];
    const sources: string[] = [];
    
    // Sync from APIs only if forceSync is requested or we have no Supabase data
    if (forceSync || supabaseOrders.length === 0) {
      // Priority 1: Try Aster API if configured
      if (asterEnv) {
      try {
        console.log("Fetching orders from Aster API...");
        // Fetch all orders from Aster API (includes open, filled, canceled, etc.)
        // Use a high limit or no limit to get all historical orders
        const asterApiOrders = await getAsterAllOrders(asterEnv, {
          limit: limit || 10000, // Increased limit to get more historical orders
        });
        
        console.log(`Aster API returned ${asterApiOrders.length} orders`);
        
        // Map Aster API order format to our HistoryOrder format
        // Aster API response format: { orderId, symbol, side, type, price, origQty, executedQty, status, time, ... }
        for (const order of asterApiOrders) {
          const symbol = order.symbol || "UNKNOWN";
          const side = (order.side === "BUY" || order.side === "buy") ? "buy" : "sell";
          const orderType = (order.type === "LIMIT" || order.type === "limit") ? "limit" : "market";
          const price = order.price != null ? Number(order.price) : undefined;
          const size = Number(order.origQty || order.quantity || order.size || 0);
          const executedQty = Number(order.executedQty || order.filledQty || 0);
          
          // Map Aster order status to our status format
          // Aster statuses: NEW, PARTIALLY_FILLED, FILLED, CANCELED, REJECTED, EXPIRED, PENDING_CANCEL
          let orderStatus: "open" | "filled" | "canceled" | "rejected" | "triggered" = "open";
          const status = (order.status || "").toUpperCase();
          
          // First, check the actual order status from API
          if (status === "FILLED") {
            orderStatus = "filled";
          } else if (status === "PARTIALLY_FILLED") {
            // Partially filled orders are still "open" if not fully filled
            orderStatus = executedQty >= size ? "filled" : "open";
          } else if (status === "CANCELED" || status === "PENDING_CANCEL" || status === "EXPIRED") {
            orderStatus = "canceled";
          } else if (status === "REJECTED") {
            orderStatus = "rejected";
          } else if (status === "NEW" || status === "") {
            orderStatus = "open";
          }
          
          // Only mark as "triggered" if it's actually a stop/trigger order AND status is still open
          // Don't override filled/canceled/rejected orders
          if (orderStatus === "open" && (order.stopPrice || order.triggerPrice || order.activationPrice || order.stopLossPrice || order.takeProfitPrice)) {
            orderStatus = "triggered";
          }
          
          // Get timestamp (time in milliseconds)
          let createdAt: string;
          if (order.time) {
            const timeMs = Number(order.time);
            createdAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
          } else if (order.updateTime) {
            const timeMs = Number(order.updateTime);
            createdAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
          } else {
            createdAt = new Date().toISOString();
          }
          
          const orderId = String(order.orderId || order.id || "");
          
          const mappedOrder = {
            id: orderId || `aster_${symbol}_${createdAt}`,
            symbol,
            side: side as "buy" | "sell",
            type: orderType as "market" | "limit",
            size: Math.abs(size),
            price: price && price > 0 ? price : undefined,
            status: orderStatus,
            createdAt,
            updatedAt: order.updateTime ? new Date(Number(order.updateTime) > 1e12 ? Number(order.updateTime) : Number(order.updateTime) * 1000).toISOString() : createdAt,
          };
          
          apiOrders.push(mappedOrder);
          
          // Prepare for Supabase save
          ordersToSave.push({
            order_id: orderId || mappedOrder.id,
            symbol,
            side,
            type: orderType,
            size: mappedOrder.size,
            price: mappedOrder.price,
            status: orderStatus,
            filled_size: executedQty,
            created_at: createdAt,
            updated_at: mappedOrder.updatedAt,
          });
        }
        
        sources.push("aster");
        console.log(`Fetched ${apiOrders.length} orders from Aster API`);
      } catch (error: any) {
        console.error("Error fetching Aster API orders:", error.message || error);
      }
      } // Close if (asterEnv) block
      
      // Priority 2: Binance orders are stored in Supabase by the Python agent
      // They should already be in Supabase from the Python agent during trading
      if (hasBinance) {
        try {
          console.log("Binance orders are stored in Supabase (populated by Python agent during trading)");
          sources.push("binance");
        } catch (error: any) {
          console.error("Error processing Binance orders:", error.message || error);
        }
      }
    }

    // Step 3: Save/Update all orders to Supabase
      if (sb && ordersToSave.length > 0) {
        try {
        console.log(`Attempting to save ${ordersToSave.length} orders to Supabase...`);
        console.log(`Sample order to save:`, ordersToSave[0]);
        
          // Upsert orders by order_id (update if exists, insert if new)
        const { data, error } = await sb.from("orders").upsert(ordersToSave as any, {
            onConflict: "order_id",
          });
        
        if (error) {
          console.error("Supabase upsert error:", error);
          throw error;
        }
        
        console.log(`Successfully saved/updated ${ordersToSave.length} orders to Supabase (${apiOrders.length} from API)`);
        } catch (error: any) {
          console.error("Error saving orders to Supabase:", error);
        console.error("Error details:", error.message, error.code, error.details);
      }
    } else if (sb && ordersToSave.length === 0 && apiOrders.length > 0) {
      // If ordersToSave is empty but we have API orders, save them directly
      console.log(`No orders in ordersToSave, but we have ${apiOrders.length} API orders. Saving directly...`);
      try {
        const apiOrdersToSave = apiOrders.map(order => ({
          order_id: order.id,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          size: order.size,
          price: order.price,
          status: order.status,
          filled_size: order.status === "filled" ? order.size : 0,
          created_at: order.createdAt,
          updated_at: order.updatedAt || order.createdAt,
        }));
        
        const { data, error } = await sb.from("orders").upsert(apiOrdersToSave as any, {
          onConflict: "order_id",
        });
        
        if (error) {
          console.error("Supabase upsert error for API orders:", error);
          throw error;
        }
        
        console.log(`Successfully saved ${apiOrdersToSave.length} API orders to Supabase`);
      } catch (error: any) {
        console.error("Error saving API orders directly to Supabase:", error);
        console.error("Error details:", error.message, error.code, error.details);
      }
    }

    // Step 4: Update order metrics (optional, non-blocking)
    if (sb && apiOrders.length > 0) {
      try {
        const { data: allOrders } = await sb
          .from("orders")
          .select("status");
        
        if (allOrders && Array.isArray(allOrders)) {
          const total = allOrders.length;
          const open = allOrders.filter((o: any) => o.status === "open").length;
          const filled = allOrders.filter((o: any) => o.status === "filled").length;
          const canceled = allOrders.filter((o: any) => o.status === "canceled").length;
          const rejected = allOrders.filter((o: any) => o.status === "rejected").length;
          
          console.log(`Order metrics - Total: ${total}, Open: ${open}, Filled: ${filled}, Canceled: ${canceled}, Rejected: ${rejected}`);
        }
      } catch {
        // Ignore errors - metrics tracking is optional
      }
    }

    // Step 5: Combine and merge results with robust deduplication
    // Use order_id as primary key, composite key as fallback
    const allOrdersMap = new Map<string, any>();
    
    // Helper function to create composite key for deduplication
    const getCompositeKey = (order: any) => {
      const timestamp = new Date(order.createdAt || order.created_at).getTime();
      const roundedPrice = order.price ? Math.round(Number(order.price) * 10000) / 10000 : 0;
      const roundedSize = Math.round(Number(order.size) * 10000) / 10000;
      return `${order.symbol}_${order.side}_${order.type}_${timestamp}_${roundedPrice}_${roundedSize}`;
    };
    
    // Add Supabase orders first (older data)
    for (const order of supabaseOrders) {
      // Use order_id as primary key, composite as fallback
      const key = order.id || order.orderId || getCompositeKey(order);
      if (!allOrdersMap.has(key)) {
        allOrdersMap.set(key, order);
      }
    }
    
    // Add/overwrite with API orders (newer, more accurate data)
    for (const order of apiOrders) {
      // Use order_id as primary key, composite as fallback
      const key = order.id || getCompositeKey(order);
      // Overwrite if exists (API data is most accurate)
      allOrdersMap.set(key, order);
    }

    // Convert to array and sort by created_at (newest first)
    const uniqueOrders = Array.from(allOrdersMap.values());
    
    uniqueOrders.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at).getTime();
      const timeB = new Date(b.createdAt || b.created_at).getTime();
      return timeB - timeA; // Descending order (newest first)
    });

    // Always return orders array, even if empty
    // This ensures the frontend receives a valid response
    return NextResponse.json({
      orders: uniqueOrders || [],
      source: sources.length > 0 ? sources.join(",") : (supabaseOrders.length > 0 ? "supabase" : "none"),
      synced: apiOrders.length > 0,
      count: uniqueOrders.length,
    });
  } catch (error: any) {
    console.error("Error fetching orders history:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch orders history" },
      { status: 500 }
    );
  }
}

