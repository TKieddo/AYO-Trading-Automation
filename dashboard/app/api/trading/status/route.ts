import { NextResponse } from "next/server";

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function POST() {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Python API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ message: "Status retrieved", data });
  } catch (error: any) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get status" },
      { status: 500 }
    );
  }
}

