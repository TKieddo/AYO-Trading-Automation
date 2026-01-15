import { NextRequest, NextResponse } from "next/server";

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { asset, side, amount, type, price } = body;

    // Validate input
    if (!asset || !side || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: asset, side, amount" },
        { status: 400 }
      );
    }

    if (type === "limit" && !price) {
      return NextResponse.json(
        { error: "Price required for limit orders" },
        { status: 400 }
      );
    }

    // Call Python trading agent
    const response = await fetch(`${PYTHON_API_URL}/api/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset, side, amount, type, price }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Python API returned ${response.status}`);
    }

    const result = await response.json();
    return NextResponse.json({ message: result.message, data: result });
  } catch (error: any) {
    console.error("Order placement error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to place order" },
      { status: 500 }
    );
  }
}

