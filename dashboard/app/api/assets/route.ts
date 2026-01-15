import { NextResponse } from "next/server";

const parseEnvAssets = (): string[] | null => {
  const raw = process.env.NEXT_PUBLIC_ASSETS || process.env.ASSETS;
  if (!raw) return null;
  const parts = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : null;
};

export async function GET() {
  // 1) Try Python API /positions for live symbols
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
    const resp = await fetch(`${base}/agent/positions`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) {
        const set = new Set<string>();
        for (const p of data) {
          const sym = (p?.symbol || p?.coin || "") as string;
          if (sym) set.add(sym);
        }
        if (set.size > 0) {
          return NextResponse.json({ assets: Array.from(set) });
        }
      }
    }
  } catch {}

  // 2) Try Python API /diary to infer assets
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
    const resp = await fetch(`${base}/agent/diary?limit=500`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      const entries: any[] = data?.entries || [];
      const set = new Set<string>();
      for (const e of entries) {
        const a = (e?.asset || "") as string;
        if (a) set.add(a);
      }
      if (set.size > 0) {
        return NextResponse.json({ assets: Array.from(set) });
      }
    }
  } catch {}

  // 3) Fallback to env
  const envAssets = parseEnvAssets();
  if (envAssets) return NextResponse.json({ assets: envAssets });

  // 4) Final default
  return NextResponse.json({ assets: ["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP"] });
}
