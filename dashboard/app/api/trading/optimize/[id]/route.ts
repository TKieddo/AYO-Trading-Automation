import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/trading/optimize/[id]
 * Get optimization status
 */
export async function GET(
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

    const { data: optimization, error } = await supabase
      .from("strategy_optimizations")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !optimization) {
      return NextResponse.json(
        { error: "Optimization not found" },
        { status: 404 }
      );
    }

    // Get latest iteration for current parameters
    const { data: latestIteration } = await supabase
      .from("optimization_iterations")
      .select("parameters, llm_reasoning")
      .eq("optimization_id", params.id)
      .order("iteration_number", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      optimization: {
        ...optimization,
        current_parameters: latestIteration?.parameters,
        llm_reasoning: latestIteration?.llm_reasoning,
      },
    });
  } catch (error: any) {
    console.error("Error fetching optimization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch optimization" },
      { status: 500 }
    );
  }
}

