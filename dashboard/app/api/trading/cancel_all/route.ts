import { NextRequest, NextResponse } from "next/server";

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { asset } = body;

    const response = await fetch(`${PYTHON_API_URL}/api/cancel-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Python API returned ${response.status}`);
    }

    const result = await response.json();
    return NextResponse.json({
      message: result.message,
      cancelledCount: result.result?.cancelled_count || 0,
    });
  } catch (error: any) {
    console.error("Cancel all error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel orders" },
      { status: 500 }
    );
  }
}

