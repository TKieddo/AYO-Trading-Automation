import { getServerSupabase } from "@/lib/supabase/server";

export async function persistPrices(rows: any[]) {
  const supabase = getServerSupabase();
  if (!supabase || !Array.isArray(rows) || rows.length === 0) return;
  try {
    const mapped = rows.map((r: any) => ({
      symbol: r.symbol,
      price: Number(r.price),
      change_24h: Number(r.change24h ?? r.change_24h ?? 0),
      change_24h_percent: Number(r.change24hPercent ?? r.change_24h_percent ?? 0),
      timestamp: r.timestamp ?? new Date().toISOString(),
    }));
    await supabase.from("prices").upsert(mapped as any, { onConflict: "symbol,timestamp" });
  } catch {}
}

export async function persistPositions(rows: any[]) {
  const supabase = getServerSupabase();
  if (!supabase || !Array.isArray(rows)) return;
  try {
    // Only persist positions with size > 0 (open positions)
    const openPositions = rows.filter((p: any) => Number(p.size ?? 0) > 0);
    
    if (openPositions.length === 0) {
      // If no open positions, mark all existing positions as closed
      await supabase
        .from("positions")
        .update({ closed_at: new Date().toISOString() })
        .is("closed_at", null);
      return;
    }

    const mapped = openPositions.map((p: any) => ({
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      size: Number(p.size ?? 0),
      entry_price: Number(p.entryPrice ?? 0),
      current_price: Number(p.currentPrice ?? 0),
      liquidation_price: p.liquidationPrice != null ? Number(p.liquidationPrice) : null,
      unrealized_pnl: Number(p.unrealizedPnl ?? 0),
      realized_pnl: Number(p.realizedPnl ?? 0),
      leverage: p.leverage ?? null,
      opened_at: p.openedAt ?? new Date().toISOString(),
      updated_at: p.updatedAt ?? new Date().toISOString(),
      closed_at: null, // Ensure it's marked as open
    }));

    // Upsert open positions
    await supabase.from("positions").upsert(mapped as any, { onConflict: "id" });

    // Get list of open position IDs to identify which ones to keep open
    const openPositionIds = new Set(mapped.map((p: any) => p.id));
    const openSymbolSides = new Set(
      mapped.map((p: any) => `${p.symbol}:${p.side}`)
    );

    // Mark positions with size = 0 as closed
    await supabase
      .from("positions")
      .update({ closed_at: new Date().toISOString() })
      .is("closed_at", null)
      .eq("size", 0);

    // Fetch all existing open positions to compare
    const existingPositions = await supabase
      .from("positions")
      .select("id, symbol, side, size")
      .is("closed_at", null)
      .gt("size", 0);

    if (existingPositions.data) {
      const toClose: string[] = [];
      for (const existing of existingPositions.data) {
        // If this position is not in the current open positions list, it was closed
        // This handles cases where:
        // 1. A position was closed and a new one opened with same symbol:side (different ID)
        // 2. A position was closed and no replacement exists
        if (!openPositionIds.has(existing.id)) {
          toClose.push(existing.id);
        }
      }
      if (toClose.length > 0) {
        await supabase
          .from("positions")
          .update({ closed_at: new Date().toISOString() })
          .in("id", toClose);
      }
    }
  } catch (error) {
    console.error("Error persisting positions:", error);
  }
}

export async function persistDecisions(rows: any[]) {
  const supabase = getServerSupabase();
  if (!supabase || !Array.isArray(rows)) return;
  try {
    const mapped = rows.map((d: any) => ({
      id: d.id,
      asset: d.asset,
      action: d.action,
      allocation_usd: d.allocationUsd ?? 0,
      tp_price: d.tpPrice ?? null,
      sl_price: d.slPrice ?? null,
      rationale: d.rationale ?? "",
      reasoning: d.reasoning ?? "",
      timestamp: d.timestamp ?? new Date().toISOString(),
    }));
    await supabase.from("decisions").upsert(mapped as any, { onConflict: "id" });
  } catch {}
}

export async function persistLogs(rows: any[]) {
  const supabase = getServerSupabase();
  if (!supabase || !Array.isArray(rows) || rows.length === 0) return;
  try {
    const mapped = rows.map((l: any) => ({
      level: l.level ?? "info",
      message: l.message ?? "",
      data: l.data ?? null,
      timestamp: l.timestamp ?? new Date().toISOString(),
    }));
    await supabase.from("trading_logs").insert(mapped);
  } catch {}
}

export async function persistPnl(rows: any[]) {
  const supabase = getServerSupabase();
  if (!supabase || !Array.isArray(rows)) return;
  try {
    const mapped = rows.map((r: any) => ({
      timestamp: r.timestamp ?? new Date().toISOString(),
      daily_pnl: Number(r.daily_pnl ?? 0),
      cumulative_pnl: Number(r.cumulative_pnl ?? 0),
    }));
    await supabase.from("pnl_series").upsert(mapped as any, { onConflict: "timestamp" });
  } catch {}
}

export async function persistPerformance(rows: any[]) {
  const supabase = getServerSupabase();
  if (!supabase || !Array.isArray(rows)) return;
  try {
    const mapped = rows.map((r: any) => ({
      date: r.date ?? new Date().toISOString(),
      value: Number(r.value ?? 0),
      pnl: Number(r.pnl ?? 0),
    }));
    await supabase.from("performance_series").upsert(mapped as any, { onConflict: "date" });
  } catch {}
}

export async function persistMetrics(obj: any) {
  const supabase = getServerSupabase();
  if (!supabase || !obj) return;
  try {
    const row = {
      total_value: Number(obj.totalValue ?? obj.total_value ?? 0),
      balance: Number(obj.balance ?? 0),
      open_positions: Number(obj.openPositions ?? obj.open_positions ?? 0),
      total_pnl: Number(obj.totalPnL ?? obj.total_pnl ?? 0),
      daily_pnl: Number(obj.dailyPnL ?? obj.daily_pnl ?? 0),
      win_rate: Number(obj.winRate ?? obj.win_rate ?? 0),
      total_trades: Number(obj.totalTrades ?? obj.total_trades ?? 0),
      leverage: Number(obj.leverage ?? 1),
      timestamp: new Date().toISOString(),
    };
    await supabase.from("account_metrics").insert(row);
  } catch {}
}

export async function persistOrders(rows: any[]) {
  const supabase = getServerSupabase();
  if (!supabase || !Array.isArray(rows) || rows.length === 0) return;
  try {
    const mapped = rows.map((o: any) => {
      // Normalize order data from Aster API format
      const orderId = String(o.orderId ?? o.oid ?? o.order_id ?? "");
      const symbol = (o.symbol ?? o.coin ?? "").replace("USDT", "");
      const sideRaw = o.side ?? (o.isBuy ? "buy" : "sell");
      const side = typeof sideRaw === "string" ? sideRaw.toLowerCase() : (sideRaw ? "buy" : "sell");
      const typeRaw = o.type ?? o.orderType ?? "market";
      const type = typeof typeRaw === "string" ? typeRaw.toLowerCase().replace("_", "") : "market";
      const statusRaw = o.status ?? "open";
      let status = typeof statusRaw === "string" ? statusRaw.toLowerCase() : "open";
      
      // Normalize status values
      if (status === "new" || status === "open") status = "open";
      else if (status === "filled" || status === "executed") status = "filled";
      else if (status === "canceled" || status === "cancelled") status = "canceled";
      else if (status === "rejected") status = "rejected";
      else if (status === "partially_filled" || status === "partiallyfilled") status = "open"; // Keep as open if partially filled
      
      // Parse timestamps
      let createdAt = o.created_at ?? o.createdAt;
      if (!createdAt && o.time) {
        const timeMs = Number(o.time);
        createdAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
      }
      if (!createdAt && o.timestamp) {
        const timeMs = Number(o.timestamp);
        createdAt = new Date(timeMs > 1e12 ? timeMs : timeMs * 1000).toISOString();
      }
      if (!createdAt) {
        createdAt = new Date().toISOString();
      }
      
      return {
        order_id: orderId,
        symbol: symbol,
        side: side,
        type: type,
        size: Number(o.size ?? o.sz ?? 0),
        price: o.price != null && o.price !== "" ? Number(o.price) : (o.px != null && o.px !== "" ? Number(o.px) : null),
        status: status,
        filled_size: Number(o.filled_size ?? o.filledSize ?? o.executedQty ?? 0),
        created_at: createdAt,
        updated_at: o.updated_at ?? o.updatedAt ?? createdAt,
      };
    }).filter((o: any) => o.order_id && o.order_id !== ""); // Filter out orders without IDs
    
    if (mapped.length === 0) return;
    
    // Upsert orders by order_id (prevents duplicates)
    await supabase.from("orders").upsert(mapped as any, { 
      onConflict: "order_id",
      ignoreDuplicates: false, // Update existing orders
    });
    
    console.log(`Persisted ${mapped.length} orders to database`);
  } catch (error: any) {
    console.error("Error persisting orders:", error);
  }
}


