import { NextResponse } from "next/server";
import { cleanupOldDecisions } from "@/lib/supabase/persist";

/**
 * Cleanup API endpoint to delete decisions older than 10 days
 * Can be called manually or scheduled via cron job
 * 
 * Usage:
 * - Manual: GET /api/cleanup/decisions
 * - Cron: Set up a cron job to call this endpoint daily
 * - Vercel Cron: Add to vercel.json cron jobs
 */
export async function GET() {
  try {
    const deletedCount = await cleanupOldDecisions();
    return NextResponse.json({ 
      success: true, 
      message: `Cleanup completed successfully`,
      deletedCount: deletedCount,
      cutoffDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error: any) {
    console.error("Error in cleanup endpoint:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Failed to cleanup old decisions" 
      },
      { status: 500 }
    );
  }
}
