import { NextRequest, NextResponse } from "next/server";
import { getHyperliquidEnv, getHyperliquidOpenOrders, getHyperliquidUserFills, getHyperliquidOrderStatus } from "@/lib/hyperliquid";
import { getAsterEnv, getAsterAllOrders } from "@/lib/aster";
import { getServerSupabase } from "@/lib/supabase/server";

// Removed Binance-specific helper functions

/**
 * Fetch ALL orders (open, filled, canceled, etc.) from Aster API (priority) or Hyperliquid for history.
 * Priority: Aster API > Hyperliquid > Supabase
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();

    // Optional query params
    const searchParams = req.nextUrl.searchParams;
    const forceSync = searchParams.get("forceSync") === "true";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 1000;

    // Step 1: Fetch existing orders from Supabase
    let supabaseOrders: any[] = [];
    if (sb && !forceSync) {
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
        }
      } catch (error: any) {
        console.error("Error fetching from Supabase:", error);
      }
    }

    // Step 2: Fetch orders from Aster API (priority) or Hyperliquid API (fallback)
    const asterEnv = getAsterEnv();
    const networkFromEnv = process.env.HYPERLIQUID_NETWORK?.toLowerCase().trim() || "mainnet";
    let env = getHyperliquidEnv();
    const asterOrders: any[] = [];
    const hyperliquidOrders: any[] = [];
    const ordersToSave: any[] = [];
    
    // Priority 1: Try Aster API first (uses same wallet credentials as trading agent)
    // Always fetch from Aster if credentials are available to get complete order history
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
          
          asterOrders.push(mappedOrder);
          
          // Prepare for Supabase save (consolidated with Hyperliquid orders)
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
        
        console.log(`Fetched ${asterOrders.length} orders from Aster API`);
      } catch (error: any) {
        console.error("Error fetching Aster API orders:", error.message || error);
        // Fall through to try Hyperliquid if Aster fails
      }
    }
    
    // Priority 2: Fall back to Hyperliquid API if Aster is not available or failed
    if (asterOrders.length === 0 && env && (forceSync || supabaseOrders.length === 0)) {
      // Ensure baseUrl matches the env var
      const expectedBaseUrl = networkFromEnv === "testnet" 
        ? "https://api.hyperliquid-testnet.xyz" 
        : "https://api.hyperliquid.xyz";
      
      if (env.baseUrl !== expectedBaseUrl) {
        env = { ...env, baseUrl: expectedBaseUrl };
      }

      try {
        // Get open orders
        const openOrders = await getHyperliquidOpenOrders(env);
        
        // Map open orders to our format
        for (const o of openOrders) {
          const coin = o.coin || o.asset || "UNKNOWN";
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
            // Check if it's a limit order
            if ("limit" in orderTypeRaw || "limitPx" in orderTypeRaw) {
              orderType = "limit";
            }
          }
          
          const orderId = String(o.oid || o.id || "");
          const price = o.px != null ? Number(o.px) : (orderType === "limit" && o.limitPx ? Number(o.limitPx) : undefined);
          const size = Number(o.sz || o.size || 0);
          
          // Determine if it's a triggered order (has trigger price)
          const hasTrigger = o.triggerPx != null || (o.orderType && typeof o.orderType === "object" && o.orderType.trigger);
          const orderStatus: "open" | "triggered" = hasTrigger ? "triggered" : "open";
          
          // Get timestamp (use current time for open orders, or time if available)
          let createdAt: string;
          if (o.time) {
            const timeMs = Number(o.time);
            createdAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
          } else {
            createdAt = new Date().toISOString();
          }
          
          const mappedOrder = {
            id: orderId,
            symbol: coin,
            side: side as "buy" | "sell",
            type: orderType,
            size: Math.abs(size),
            price: price && price > 0 ? price : undefined,
            status: orderStatus,
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
            status: orderStatus,
            filled_size: 0, // Open/triggered orders haven't been filled yet
            created_at: createdAt,
            updated_at: createdAt,
          });
        }
        
        // Get fills (executed orders) - these are orders that were filled
        const fills = await getHyperliquidUserFills(env, limit);
        
        // Extract all order IDs from fills and open orders to check their statuses
        const orderIdsFromFills = new Set<string>();
        fills.forEach((fill: any) => {
          if (fill.oid) orderIdsFromFills.add(String(fill.oid));
        });
        
        // Also collect order IDs from open orders
        const orderIdsFromOpen = new Set<string>();
        openOrders.forEach((o: any) => {
          if (o.oid || o.id) orderIdsFromOpen.add(String(o.oid || o.id));
        });
        
        // Combine all order IDs to query status
        const allOrderIds = new Set([...orderIdsFromFills, ...orderIdsFromOpen]);
        
        // Also get order IDs from Supabase that might have changed status
        let dbOrderIds: string[] = [];
        if (sb) {
          try {
            const { data: dbOrders } = await sb
              .from("orders")
              .select("order_id")
              .limit(1000); // Get recent order IDs
            if (dbOrders && Array.isArray(dbOrders)) {
              dbOrderIds = dbOrders.map((o: any) => String(o.order_id || "")).filter(Boolean);
              dbOrderIds.forEach(id => allOrderIds.add(id));
            }
          } catch (err) {
            console.warn("Could not fetch order IDs from database:", err);
          }
        }
        
        // Get order statuses for all order IDs (includes filled, canceled, rejected, triggered)
        let orderStatuses: any[] = [];
        if (allOrderIds.size > 0) {
          try {
            const statusArray = await getHyperliquidOrderStatus(env, Array.from(allOrderIds));
            orderStatuses = Array.isArray(statusArray) ? statusArray : [];
          } catch (err) {
            console.warn("Could not fetch order statuses, will use fills and open orders only:", err);
          }
        }
        
        // Create status map
        // Hyperliquid orderStatus returns: [{ oid: string, status: { resting | filled | cancelled | error } }]
        const statusMap = new Map<string, { resting?: any; filled?: any; cancelled?: any; error?: any }>();
        orderStatuses.forEach((statusObj: any) => {
          // Hyperliquid orderStatus returns objects with oid and status object
          const oid = statusObj.oid || statusObj.id;
          if (oid) {
            // statusObj.status contains: { resting: {...} } or { filled: {...} } or { cancelled: {...} } or { error: "..." }
            // OR statusObj directly contains these fields
            const statusData = statusObj.status || statusObj;
            statusMap.set(String(oid), statusData);
          }
        });
        
        // Map fills to order format (these are filled orders)
        for (const fill of fills) {
          const coin = fill.coin || fill.asset || "UNKNOWN";
          const isBuy = fill.side === "B" || fill.side === "Buy" || fill.isBuy === true || fill.isBuyer === true;
          const side = isBuy ? "buy" : "sell";
          
          // Fills are typically market orders (immediate execution)
          const orderType: "market" | "limit" = "market";
          
          const orderId = String(fill.oid || fill.id || "");
          const price = Number(fill.px || fill.price || 0);
          const size = Number(fill.sz || fill.size || 0);
          
          // Get timestamp
          let createdAt: string;
          if (fill.time) {
            const timeMs = Number(fill.time);
            createdAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
          } else if (fill.timestamp) {
            const timeMs = Number(fill.timestamp);
            createdAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
          } else {
            createdAt = new Date().toISOString();
          }
          
          // Determine status from order status map or default to filled
          let orderStatus: "open" | "filled" | "canceled" | "rejected" | "triggered" = "filled";
          const statusInfo = statusMap.get(orderId);
          if (statusInfo) {
            // Hyperliquid status format: { resting: {...} } or { filled: {...} } or { cancelled: {...} } or { error: "..." }
            if (statusInfo.filled !== undefined) {
                orderStatus = "filled";
            } else if (statusInfo.cancelled !== undefined) {
                orderStatus = "canceled";
            } else if (statusInfo.error !== undefined || typeof statusInfo.error === "string") {
                orderStatus = "rejected";
            } else if (statusInfo.resting !== undefined) {
              // Check if it's a triggered order (resting orders with trigger conditions)
              if (statusInfo.resting.triggerPx || statusInfo.resting.trigger) {
                orderStatus = "triggered";
              } else {
                orderStatus = "open";
              }
            }
          }
          
          const mappedOrder = {
            id: orderId || `fill_${coin}_${createdAt}`,
            symbol: coin,
            side: side as "buy" | "sell",
            type: orderType,
            size: Math.abs(size),
            price: price > 0 ? price : undefined,
            status: orderStatus,
            createdAt,
            updatedAt: createdAt,
          };
              
          hyperliquidOrders.push(mappedOrder);
              
              // Prepare for Supabase save
              ordersToSave.push({
            order_id: mappedOrder.id,
            symbol: coin,
                side,
                type: orderType,
                size: mappedOrder.size,
                price: mappedOrder.price,
                status: orderStatus,
            filled_size: orderStatus === "filled" ? mappedOrder.size : 0,
            created_at: createdAt,
            updated_at: createdAt,
          });
        }
        
        // Also check order statuses that aren't in fills (canceled, rejected, triggered orders)
        // These might not have fills associated with them
        for (const statusObj of orderStatuses) {
          const oid = String(statusObj.oid || statusObj.id || "");
          if (!oid) continue;
          
          // Get the status data (might be nested in statusObj.status)
          const statusData = statusObj.status || statusObj;
          
          // Skip if we already processed this order from fills and it's filled
          if (orderIdsFromFills.has(oid) && statusData.filled) continue;
          
          // Process orders that weren't filled or have different status
          let orderStatus: "open" | "filled" | "canceled" | "rejected" | "triggered" = "open";
          if (statusData.filled !== undefined) {
            orderStatus = "filled";
          } else if (statusData.cancelled !== undefined) {
            orderStatus = "canceled";
          } else if (statusData.error !== undefined || typeof statusData.error === "string") {
            orderStatus = "rejected";
          } else if (statusData.resting !== undefined) {
            // Check if it's a triggered order (resting orders with trigger conditions)
            const restingData = statusData.resting;
            if (restingData.triggerPx || restingData.trigger || (restingData.order && restingData.order.triggerPx)) {
              orderStatus = "triggered";
            } else {
              orderStatus = "open";
            }
          }
          
          // Only add if not already in our list (from open orders or fills)
          const existingOrder = hyperliquidOrders.find(o => o.id === oid);
          if (!existingOrder) {
            // Try to extract order details from status object or statusData
            const orderDetails = statusData.resting?.order || statusData.filled?.order || statusData.cancelled?.order || statusObj;
            const coin = orderDetails.coin || statusObj.coin || statusObj.asset || "UNKNOWN";
            const isBuy = orderDetails.isBuy === true || orderDetails.side === "B" || statusObj.isBuy === true || statusObj.side === "B";
            const side = isBuy ? "buy" : "sell";
            const price = orderDetails.px || orderDetails.price || orderDetails.limitPx || statusObj.px || statusObj.price || null;
            const size = orderDetails.sz || orderDetails.size || statusObj.sz || statusObj.size || 0;
            
            let orderType: "market" | "limit" = "market";
            const orderTypeRaw = orderDetails.orderType || statusObj.orderType;
            if (orderTypeRaw) {
              if (typeof orderTypeRaw === "string" && orderTypeRaw.toLowerCase().includes("limit")) {
                orderType = "limit";
              } else if (typeof orderTypeRaw === "object" && ("limit" in orderTypeRaw || "limitPx" in orderTypeRaw)) {
                orderType = "limit";
              }
            }
            
            let createdAt: string;
            if (orderDetails.time || statusObj.time) {
              const timeMs = Number(orderDetails.time || statusObj.time);
              createdAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
            } else {
              createdAt = new Date().toISOString();
            }
            
            const mappedOrder = {
              id: oid,
              symbol: coin,
              side: side as "buy" | "sell",
              type: orderType,
              size: Math.abs(size),
              price: price && price > 0 ? price : undefined,
              status: orderStatus,
              createdAt,
              updatedAt: createdAt,
            };
            
            hyperliquidOrders.push(mappedOrder);
            
            ordersToSave.push({
              order_id: oid,
              symbol: coin,
              side,
              type: orderType,
              size: mappedOrder.size,
              price: mappedOrder.price,
              status: orderStatus,
              filled_size: orderStatus === "filled" ? mappedOrder.size : 0,
              created_at: createdAt,
              updated_at: createdAt,
            });
          } else {
            // Update existing order status if it changed (e.g., open -> canceled)
            const existingIndex = hyperliquidOrders.findIndex(o => o.id === oid);
            if (existingIndex >= 0 && hyperliquidOrders[existingIndex].status !== orderStatus) {
              hyperliquidOrders[existingIndex].status = orderStatus;
              
              // Update in ordersToSave as well
              const saveIndex = ordersToSave.findIndex(o => o.order_id === oid);
              if (saveIndex >= 0) {
                ordersToSave[saveIndex].status = orderStatus;
                ordersToSave[saveIndex].updated_at = new Date().toISOString();
              }
            }
          }
        }
      } catch (error: any) {
        console.error("Error fetching Hyperliquid orders:", error.message || error);
      }
      }

    // Step 3: Save/Update all orders to Supabase (from both Aster and Hyperliquid)
      if (sb && ordersToSave.length > 0) {
        try {
        console.log(`Attempting to save ${ordersToSave.length} orders to Supabase...`);
        console.log(`Sample order to save:`, ordersToSave[0]);
        
          // Upsert orders by order_id (update if exists, insert if new)
        const { data, error } = await sb.from("orders").upsert(ordersToSave, {
            onConflict: "order_id",
          });
        
        if (error) {
          console.error("Supabase upsert error:", error);
          throw error;
        }
        
        console.log(`Successfully saved/updated ${ordersToSave.length} orders to Supabase (${asterOrders.length} from Aster, ${hyperliquidOrders.length} from Hyperliquid)`);
        } catch (error: any) {
          console.error("Error saving orders to Supabase:", error);
        console.error("Error details:", error.message, error.code, error.details);
      }
    } else if (sb && ordersToSave.length === 0 && asterOrders.length > 0) {
      // If ordersToSave is empty but we have Aster orders, save them directly
      console.log(`No orders in ordersToSave, but we have ${asterOrders.length} Aster orders. Saving directly...`);
      try {
        const asterOrdersToSave = asterOrders.map(order => ({
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
        
        const { data, error } = await sb.from("orders").upsert(asterOrdersToSave, {
          onConflict: "order_id",
        });
        
        if (error) {
          console.error("Supabase upsert error for Aster orders:", error);
          throw error;
        }
        
        console.log(`Successfully saved ${asterOrdersToSave.length} Aster orders to Supabase`);
      } catch (error: any) {
        console.error("Error saving Aster orders directly to Supabase:", error);
        console.error("Error details:", error.message, error.code, error.details);
      }
    }

    // Step 4: Update order metrics (optional, non-blocking)
    if (sb && (asterOrders.length > 0 || hyperliquidOrders.length > 0)) {
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
    
    // Add/overwrite with API orders (Aster first, then Hyperliquid - newer, more accurate data)
    for (const order of asterOrders) {
      // Use order_id as primary key, composite as fallback
      const key = order.id || getCompositeKey(order);
      // Overwrite if exists (Aster data is most accurate)
      allOrdersMap.set(key, order);
    }
    
    for (const order of hyperliquidOrders) {
      // Use order_id as primary key, composite as fallback
      const key = order.id || getCompositeKey(order);
      // Only add if not already present from Aster
      if (!allOrdersMap.has(key)) {
      allOrdersMap.set(key, order);
      }
    }

    // Convert to array and sort by created_at (newest first)
    const uniqueOrders = Array.from(allOrdersMap.values());
    
    uniqueOrders.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at).getTime();
      const timeB = new Date(b.createdAt || b.created_at).getTime();
      return timeB - timeA; // Descending order (newest first)
    });

    return NextResponse.json({
      orders: uniqueOrders,
      source: asterOrders.length > 0 ? "aster" : (hyperliquidOrders.length > 0 ? "hyperliquid" : "supabase"),
      synced: asterOrders.length > 0 || hyperliquidOrders.length > 0,
    });
  } catch (error: any) {
    console.error("Error fetching orders history:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch orders history" },
      { status: 500 }
    );
  }
}

