import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getHyperliquidEnv, getHyperliquidUserFills } from "@/lib/hyperliquid";

// Backfill user trades using Hyperliquid userFills endpoint and rebuild performance
// Env required: HYPERLIQUID_WALLET_ADDRESS, (optional) HYPERLIQUID_NETWORK

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit: number = body.limit || 10000; // Hyperliquid can return up to 10k fills
    
    const networkFromEnv = process.env.HYPERLIQUID_NETWORK?.toLowerCase().trim() || "mainnet";
    let env = getHyperliquidEnv();
    if (!env) return NextResponse.json({ error: "Hyperliquid API creds missing. Set HYPERLIQUID_WALLET_ADDRESS" }, { status: 400 });
    
    // Ensure baseUrl matches the env var
    const expectedBaseUrl = networkFromEnv === "testnet" 
      ? "https://api.hyperliquid-testnet.xyz" 
      : "https://api.hyperliquid.xyz";
    
    if (env.baseUrl !== expectedBaseUrl) {
      env = { ...env, baseUrl: expectedBaseUrl };
    }
    
    const sb = getServerSupabase();
    if (!sb) return NextResponse.json({ error: "Supabase service role missing" }, { status: 500 });

    // Fetch fills from Hyperliquid
    const fills = await getHyperliquidUserFills(env, limit);
    
    if (!Array.isArray(fills) || fills.length === 0) {
      return NextResponse.json({ error: "No fills found or invalid response" }, { status: 400 });
    }
    
    // Map Hyperliquid fills to our schema
    const ordersToSave: any[] = [];
    const tradesToSave: any[] = [];
    
    for (const fill of fills) {
      const coin = fill.coin || fill.asset || "UNKNOWN";
      const isBuy = fill.side === "B" || fill.side === "Buy" || fill.isBuy === true || fill.isBuyer === true;
      const side = isBuy ? "buy" : "sell";
      const price = Number(fill.px || fill.price || 0);
      const size = Number(fill.sz || fill.size || 0);
      const realizedPnl = fill.closedPnl != null ? Number(fill.closedPnl) : null;
      
      // Get timestamp
      let executedAt: string;
      if (fill.time) {
        const timeMs = Number(fill.time);
        executedAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
      } else if (fill.timestamp) {
        const timeMs = Number(fill.timestamp);
        executedAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
      } else {
        executedAt = new Date().toISOString();
      }
      
      const orderId = String(fill.oid || fill.id || `fill_${coin}_${executedAt}`);
      
      // Save to orders table
      ordersToSave.push({
        order_id: orderId,
        symbol: coin,
        side,
        type: "market",
        size: Math.abs(size),
        price: price > 0 ? price : null,
        status: "filled",
        filled_size: Math.abs(size),
        created_at: executedAt,
        updated_at: executedAt,
      });
      
      // Save to trades table (will link to orders after orders are saved)
      tradesToSave.push({
        symbol: coin,
        side,
        size: Math.abs(size),
        price,
        fee: fill.fee != null ? Number(fill.fee) : 0,
        // Store PnL: null if not realized, otherwise the actual value (can be 0)
        pnl: realizedPnl !== null ? realizedPnl : null,
        executed_at: executedAt,
        order_id_text: orderId, // Store text order_id temporarily for lookup
      });
    }
    
    // Step 1: Save orders first
    if (ordersToSave.length > 0) {
      await sb.from("orders").upsert(ordersToSave as any, { onConflict: "order_id" });
      console.log(`Saved ${ordersToSave.length} orders from Hyperliquid fills`);
    }
    
    // Step 2: Resolve order_id strings to UUIDs and save trades
    if (tradesToSave.length > 0) {
      // Build map of order_id (text) -> orders.id (UUID)
      const orderIdMap = new Map<string, string>();
      const orderIdStrings = tradesToSave
        .map(t => (t as any).order_id_text)
        .filter((id): id is string => id != null);
      
      if (orderIdStrings.length > 0) {
        const { data: ordersData } = await sb
          .from("orders")
          .select("id, order_id")
          .in("order_id", orderIdStrings);
        
        if (ordersData && Array.isArray(ordersData)) {
          for (const order of ordersData) {
            if (order.order_id && order.id) {
              orderIdMap.set(String(order.order_id), order.id);
            }
          }
        }
      }
      
      // Map trades with resolved order UUIDs
      const tradesWithOrderUuids = tradesToSave.map((trade: any) => {
        const resolvedOrderId = trade.order_id_text && orderIdMap.has(String(trade.order_id_text))
          ? orderIdMap.get(String(trade.order_id_text))!
          : null;
        
        return {
          symbol: trade.symbol,
          side: trade.side,
          size: trade.size,
          price: trade.price,
          fee: trade.fee,
          pnl: trade.pnl,
          executed_at: trade.executed_at,
          order_id: resolvedOrderId, // Now UUID or null
        };
      });
      
      // Insert trades, handling duplicates gracefully
      for (const trade of tradesWithOrderUuids) {
        try {
          const { error } = await sb.from("trades").insert(trade as any);
          if (error) {
            // Ignore duplicate errors
            console.log(`Skipped duplicate trade: ${error.message}`);
          }
        } catch (err) {
          // Ignore any errors (duplicates, etc.)
        }
      }
      console.log(`Saved ${tradesWithOrderUuids.length} trades from Hyperliquid fills`);
    }

    // Rebuild performance_series from trades
    const { data: tdata, error } = await sb
      .from("trades")
      .select("executed_at, pnl")
      .order("executed_at", { ascending: true });
    if (!error && Array.isArray(tdata)) {
      let cumulative = 0;
      const series = tdata.map((t: any) => {
        const daily = t.pnl != null ? Number(t.pnl) : 0;
        cumulative += daily;
        return { date: t.executed_at, value: 10000 + cumulative, pnl: daily };
      });
      if (series.length) {
        const mapped = series.map((s) => ({ date: s.date, value: s.value, pnl: s.pnl }));
        await sb.from("performance_series").upsert(mapped as any, { onConflict: "date" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed" }, { status: 500 });
  }
}


