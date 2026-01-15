import { NextResponse } from "next/server";

// Resolve Python API base URL robustly to avoid accidentally calling Next server
const resolvePythonApiUrl = () => {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
};
const PYTHON_API_URL = resolvePythonApiUrl();

export async function POST() {
  try {
    // Try /status endpoint first (simpler GET), then fallback to /api/test
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    let response;
    try {
      // Try GET /status first
      response = await fetch(`${PYTHON_API_URL}/status`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
    } catch {
      // Fallback to POST /api/test
      response = await fetch(`${PYTHON_API_URL}/api/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail = "";
      try { 
        const errorData = await response.json();
        detail = errorData.error || JSON.stringify(errorData);
      } catch {}
      // Return 200 with connected: false to avoid surfacing 5xx to UI
      return NextResponse.json({ connected: false, error: `Python API returned ${response.status}: ${detail}`, target: PYTHON_API_URL });
    }

    const data = await response.json();
    
    // Ensure connected field is set
    if (data.connected === undefined) {
      data.connected = true;
    }

    return NextResponse.json({ ...data, target: PYTHON_API_URL });
  } catch (error: any) {
    // Handle abort (timeout)
    if (error.name === 'AbortError' || error.code === 'ECONNREFUSED') {
      return NextResponse.json({
        connected: false,
        error: "Python API server is offline or unreachable. Please start the trading agent.",
        target: PYTHON_API_URL,
      });
    }
    
    // Handle network errors
    return NextResponse.json({
      connected: false,
      error: error.message || "Failed to connect to trading agent. Ensure Python API is running on port 3000.",
      target: PYTHON_API_URL,
    });
  }
}

export async function GET() {
  // Mirror POST for easier debugging via browser
  return POST();
}

