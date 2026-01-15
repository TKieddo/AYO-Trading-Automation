import { NextResponse } from "next/server";

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const asset = searchParams.get("asset");
    const amount = searchParams.get("amount");

    if (!asset || !amount) {
      return NextResponse.json(
        { error: "asset and amount parameters are required" },
        { status: 400 }
      );
    }

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(
      `${PYTHON_API_URL}/api/trading-info?asset=${encodeURIComponent(asset)}&amount=${encodeURIComponent(amount)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Python API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch trading info from Python API:", error);
    
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: "Connection timeout - Python API server may be offline" },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch trading info" },
      { status: 500 }
    );
  }
}

