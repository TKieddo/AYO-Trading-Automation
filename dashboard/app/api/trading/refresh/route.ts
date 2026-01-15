import { NextResponse } from "next/server";

export async function POST() {
  // This triggers a refresh of all data
  // In production, could trigger a sync from Python agent
  
  return NextResponse.json({
    message: "Data refresh initiated",
    timestamp: new Date().toISOString(),
  });
}

