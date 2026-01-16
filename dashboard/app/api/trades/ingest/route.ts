import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Ingest real-time trades from the Python agent
// Body: { trades: [{ symbol, side, size, price, fee?, pnl?, executed_at, order_id? }], orders?: [...] }
export async function POST(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    if (!sb) return NextResponse.json({ error: "Supabase service role missing" }, { status: 500 });
    const body = await req.json();
    const trades = Array.isArray(body.trades) ? body.trades : [];
    const orders = Array.isArray(body.orders) ? body.orders : [];

    if (!trades.length && !orders.length) {
      return NextResponse.json({ error: "No trades or orders provided" }, { status: 400 });
    }

    if (orders.length) {
      const mappedOrders = orders.map((o: any) => ({
        order_id: String(o.order_id ?? o.oid ?? ""),
        symbol: o.symbol ?? o.coin,
        side: o.side,
        type: o.type ?? "market",
        size: Number(o.size ?? 0),
        price: o.price != null ? Number(o.price) : null,
        status: o.status ?? "filled",
        filled_size: Number(o.filled_size ?? 0),
        created_at: o.created_at ?? new Date().toISOString(),
        updated_at: o.updated_at ?? new Date().toISOString(),
      }));
      if (mappedOrders.length) await sb.from("orders").upsert(mappedOrders as any, { onConflict: "order_id" });
    }

    if (trades.length) {
      type MappedTrade = {
        symbol: string;
        side: string;
        size: number;
        price: number;
        fee: number;
        pnl: number | null;
        executed_at: string;
        order_id: string | null;
      };
      
      const mappedTrades: MappedTrade[] = trades.map((t: any) => ({
        symbol: t.symbol,
        side: t.side,
        size: Number(t.size ?? 0),
        price: Number(t.price ?? 0),
        fee: t.fee != null ? Number(t.fee) : 0,
        pnl: t.pnl != null ? Number(t.pnl) : null,
        executed_at: t.executed_at ?? new Date().toISOString(),
        order_id: t.order_id ?? null,
      }));
      if (mappedTrades.length) await sb.from("trades").insert(mappedTrades as any);

      // Update performance_series incrementally when pnl provided
      const pnlTrades = mappedTrades.filter((t: MappedTrade) => t.pnl != null);
      if (pnlTrades.length) {
        // Get last cumulative value
        const { data: last } = await sb
          .from("performance_series")
          .select("date, value")
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();
        let base = last ? Number((last as any).value) : 10000;
        const series = pnlTrades
          .sort((a: MappedTrade, b: MappedTrade) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())
          .map((t: MappedTrade) => {
            base = base + Number(t.pnl);
            return { date: t.executed_at, value: base, pnl: Number(t.pnl) };
          });
        await sb.from("performance_series").upsert(series as any, { onConflict: "date" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed" }, { status: 500 });
  }
}


