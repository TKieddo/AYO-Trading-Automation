import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/trading/strategies
 * Fetch all strategies
 */
export async function GET() {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("strategies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching strategies:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch strategies" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      strategies: data || [],
    });
  } catch (error: any) {
    console.error("Error fetching strategies:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch strategies" },
      { status: 500 }
    );
  }
}

