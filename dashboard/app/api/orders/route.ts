import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { fetchJsonWithRetry, cacheGet, cacheSet } from "@/lib/http";
import { persistOrders } from "@/lib/supabase/persist";
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

export async function GET() {
  // Prefer persisted orders (complete) and merge live if available
  const supabase = getSupabase();
  let supaTransformed: any[] = [];
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_id, symbol, side, type, size, price, status, filled_size, created_at, updated_at"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      supaTransformed = (data || []).map((order: any) => ({
        id: order.id || String(order.order_id),
        orderId: String(order.order_id),
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        size: Number(order.size),
        price: order.price != null ? Number(order.price) : undefined,
        status: order.status,
        filledSize: order.filled_size != null ? Number(order.filled_size) : 0,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      }));
    }
  } catch (e) {
    console.error("Failed to fetch orders from Supabase:", e);
  }
  try {
    // Fetch from Python API /api/orders endpoint (Aster orders)
    const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const data = await fetchJsonWithRetry<any[]>(`${PYTHON_API_URL}/api/orders`, { timeoutMs: 20000, cache: "no-store" }, 2, 300);
    
    // Persist to database
    persistOrders(data).catch((err) => {
      console.error("Error persisting orders:", err);
    });
    
    cacheSet("orders", data, 5000);
      const live = data.map((order: any, index: number) => ({
        id: order.oid?.toString() || `order-${index}`,
        orderId: String(order.oid || order.order_id || ""),
        symbol: order.coin || order.symbol,
        side: order.isBuy ? "buy" : "sell",
        type: order.order_type || order.type || "market",
        size: order.sz || order.size,
        price: order.px || order.price,
        status: order.status || "open",
        filledSize: order.filled_size || order.filledSize || 0,
        createdAt: order.created_at || order.createdAt || new Date().toISOString(),
        updatedAt: order.updated_at || order.updatedAt || new Date().toISOString(),
      }));
    
    // Helper function to create composite key for deduplication
    const getCompositeKey = (order: any) => {
      const timestamp = new Date(order.createdAt).getTime();
      const roundedPrice = order.price ? Math.round(Number(order.price) * 10000) / 10000 : 0;
      const roundedSize = Math.round(Number(order.size) * 10000) / 10000;
      return `${order.symbol}_${order.side}_${order.type}_${timestamp}_${roundedPrice}_${roundedSize}`;
    };
    
    // Merge by orderId (prefer live), with composite key fallback for deduplication
    const map = new Map<string, any>();
    const compositeMap = new Map<string, any>();
    
    // Add Supabase orders first
    for (const o of supaTransformed) {
      const key = o.orderId || o.id || getCompositeKey(o);
      if (!map.has(key)) {
        map.set(key, o);
        compositeMap.set(getCompositeKey(o), o);
      }
    }
    
    // Add/overwrite with live orders (prefer live data)
    for (const o of live) {
      const key = o.orderId || o.id || getCompositeKey(o);
      // Check if duplicate by composite key even if orderId differs
      const compositeKey = getCompositeKey(o);
      if (compositeMap.has(compositeKey) && map.has(key)) {
        // Already exists, skip
        continue;
      }
      map.set(key, o);
      compositeMap.set(compositeKey, o);
    }
    
    const merged = Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(merged);
  } catch (error) {
    const cached = cacheGet<any[]>("orders");
    if (cached) {
      const live = cached.map((order: any, index: number) => ({
          id: order.oid?.toString() || `order-${index}`,
          orderId: String(order.oid || order.order_id || ""),
          symbol: order.coin || order.symbol,
          side: order.isBuy ? "buy" : "sell",
          type: order.order_type || order.type || "market",
          size: order.sz || order.size,
          price: order.px || order.price,
          status: order.status || "open",
          filledSize: order.filled_size || order.filledSize || 0,
          createdAt: order.created_at || order.createdAt || new Date().toISOString(),
          updatedAt: order.updated_at || order.updatedAt || new Date().toISOString(),
        }));
      
      // Helper function to create composite key for deduplication
      const getCompositeKey = (order: any) => {
        const timestamp = new Date(order.createdAt).getTime();
        const roundedPrice = order.price ? Math.round(Number(order.price) * 10000) / 10000 : 0;
        const roundedSize = Math.round(Number(order.size) * 10000) / 10000;
        return `${order.symbol}_${order.side}_${order.type}_${timestamp}_${roundedPrice}_${roundedSize}`;
      };
      
      const map = new Map<string, any>();
      const compositeMap = new Map<string, any>();
      
      // Add Supabase orders first
      for (const o of supaTransformed) {
        const key = o.orderId || o.id || getCompositeKey(o);
        if (!map.has(key)) {
          map.set(key, o);
          compositeMap.set(getCompositeKey(o), o);
        }
      }
      
      // Add/overwrite with live orders (prefer live data)
      for (const o of live) {
        const key = o.orderId || o.id || getCompositeKey(o);
        const compositeKey = getCompositeKey(o);
        if (compositeMap.has(compositeKey) && map.has(key)) {
          continue; // Skip duplicates
        }
        map.set(key, o);
        compositeMap.set(compositeKey, o);
      }
      
      const merged = Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json(merged);
    }
    console.error("Failed to fetch orders from Python API:", error);
  }
  // Final fallback: just Supabase results gathered earlier
  return NextResponse.json(supaTransformed);
}

