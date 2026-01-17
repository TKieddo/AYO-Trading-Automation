import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { persistPrices } from "@/lib/supabase/persist";

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

export async function GET() {
	try {
		// Add timeout to prevent hanging
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 20000);
		
		const response = await fetch(`${BASE}/agent/api/prices`, {
			method: "GET",
			headers: { "Content-Type": "application/json" },
			cache: "no-store",
			signal: controller.signal,
		});
		
		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`Python API returned ${response.status}`);
		}

		const raw = await response.json();
		// Normalize to expected PriceData shape
		const data = Array.isArray(raw)
			? raw.map((p: any) => ({
					symbol: String(p.symbol || p.asset || "").toUpperCase(),
					price: Number(p.price ?? 0),
					change24h: Number(p.change24h ?? p.change_24h ?? 0),
					change24hPercent: Number(p.change24hPercent ?? p.change_24h_percent ?? 0),
					timestamp: p.timestamp || new Date().toISOString(),
				}))
			: [];

		persistPrices(data).catch(() => {});
		cacheSet("prices", data, 5000);
		return NextResponse.json(data);
	} catch (error: any) {
		// Silently handle connection errors - Python agent may not be running
		if (error.name === 'AbortError') {
			console.warn("Prices fetch timed out");
		} else if (error.code !== 'ECONNREFUSED' && !error.message?.includes('fetch failed') && !error.message?.includes('404')) {
			console.error("Failed to fetch prices from Python API:", error);
		}
		const cached = cacheGet<any[]>("prices");
		if (cached) return NextResponse.json(cached);
	}

	// Fallback to Supabase prices
	try {
		const supabase = getSupabase();
		if (supabase) {
			const { data, error } = await supabase
				.from("prices")
				.select("symbol, price, change_24h, change_24h_percent, timestamp")
				.order("timestamp", { ascending: false });
			if (error) throw error;
			return NextResponse.json(
				(data || []).map((p: any) => ({
					symbol: p.symbol,
					price: Number(p.price),
					change24h: Number(p.change_24h || 0),
					change24hPercent: Number(p.change_24h_percent || 0),
					timestamp: p.timestamp,
				}))
			);
		}
	} catch (e) {
		console.error("Failed to fetch prices from Supabase:", e);
	}

	return NextResponse.json([], { status: 500 });
}

