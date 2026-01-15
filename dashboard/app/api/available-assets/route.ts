import { NextResponse } from "next/server";

// Proxy internally to our unified /api/assets endpoint to avoid Python dependency here
export async function GET() {
  try {
    const base = (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()) || "http://localhost:3001";
    const resp = await fetch(`${base.replace(/\/$/, "")}/api/assets`, { cache: "no-store" });
    if (resp.ok) {
      const payload = await resp.json();
      // Normalize to {assets: string[]} shape if /api/assets returned an array
      if (Array.isArray(payload)) return NextResponse.json({ assets: payload });
      if (payload?.assets) return NextResponse.json({ assets: payload.assets });
    }
  } catch (error) {
    console.error("Failed to fetch /api/assets:", error);
  }
  return NextResponse.json({ assets: [] });
}

