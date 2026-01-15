import { NextRequest, NextResponse } from "next/server";

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, side, size } = body;

    // Validate input
    if (!symbol || !side || !size) {
      return NextResponse.json(
        { error: "Missing required fields: symbol, side, size" },
        { status: 400 }
      );
    }

    // Extract asset from symbol (e.g., "BTC/USDT" -> "BTC")
    const asset = symbol.split('/')[0];

    // Determine opposite side for closing
    // If position is long, we need to sell to close
    // If position is short, we need to buy to close
    const closeSide = side === 'long' ? 'sell' : 'buy';

    // Call Python trading agent to close position
    const response = await fetch(`${PYTHON_API_URL}/api/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        asset, 
        side: closeSide, 
        amount: size, 
        type: "market",
        reduceOnly: true 
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Python API returned ${response.status}`);
    }

    const result = await response.json();
    return NextResponse.json({ 
      success: true,
      message: result.message || `Position closed: ${size} ${asset}`,
      data: result 
    });
  } catch (error: any) {
    console.error("Close position error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to close position" },
      { status: 500 }
    );
  }
}

