import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/trading/optimize/[id]/stop
 * Stop running optimization
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 500 }
      );
    }

    const updateData: any = {
      status: "stopped",
      stopped_reason: "User requested stop",
      completed_at: new Date().toISOString(),
    };
    const query = supabase.from("strategy_optimizations") as any;
    const { data: optimization, error: updateError } = await query
      .update(updateData)
      .eq("id", id)
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

