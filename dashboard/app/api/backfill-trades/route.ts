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
      
      // Save to trades table
      tradesToSave.push({
        symbol: coin,
        side,
        size: Math.abs(size),
        price,
        fee: fill.fee != null ? Number(fill.fee) : 0,
        // Store PnL: null if not realized, otherwise the actual value (can be 0)
        pnl: realizedPnl !== null ? realizedPnl : null,
        executed_at: executedAt,
        order_id: null, // Not linking to orders table for now
      });
    }
    
    if (ordersToSave.length > 0) {
      await sb.from("orders").upsert(ordersToSave, { onConflict: "order_id" });
      console.log(`Saved ${ordersToSave.length} orders from Hyperliquid fills`);
    }
    
    if (tradesToSave.length > 0) {
      // Insert trades, handling duplicates gracefully
      for (const trade of tradesToSave) {
        try {
          await sb.from("trades").insert(trade).catch(() => {
            // Ignore duplicate errors
          });
        } catch {}
      }
      console.log(`Saved ${tradesToSave.length} trades from Hyperliquid fills`);
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
        await sb.from("performance_series").upsert(mapped, { onConflict: "date" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed" }, { status: 500 });
  }
}


