import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * GET portfolio assets from database
 * Returns all portfolio assets sorted by holding value
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("portfolio_assets")
      .select("*")
      .neq("symbol", "_TOTAL_") // Exclude summary row from assets list
      .order("holding_value", { ascending: false });

    if (error) {
      console.error("Failed to fetch portfolio assets:", error);
      return NextResponse.json(
        { error: "Failed to fetch portfolio assets", details: error.message },
        { status: 500 }
      );
    }

    // Map database format to Asset format
    const assets = (data || []).map((a: any) => ({
      symbol: a.symbol,
      name: a.name,
      logoUrl: a.logo_url || "",
      price: Number(a.price || 0),
      change24h: Number(a.change_24h || 0),
      holdingQty: Number(a.holding_qty || 0),
      holdingValue: Number(a.holding_value || 0),
    }));

    return NextResponse.json({
      assets,
      count: assets.length,
    });
  } catch (error: any) {
    console.error("Error fetching portfolio assets:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch portfolio assets" },
      { status: 500 }
    );
  }
}
