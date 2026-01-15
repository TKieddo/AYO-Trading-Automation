import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/trading/optimize/[id]/stop
 * Stop running optimization
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 500 }
      );
    }

    const { data: optimization, error: updateError } = await supabase
      .from("strategy_optimizations")
      .update({
        status: "stopped",
        stopped_reason: "User requested stop",
        completed_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to stop optimization" },
        { status: 500 }
      );
    }

    // TODO: Stop Python optimization process

    return NextResponse.json({
      success: true,
      optimization,
      message: "Optimization stopped",
    });
  } catch (error: any) {
    console.error("Error stopping optimization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stop optimization" },
      { status: 500 }
    );
  }
}

