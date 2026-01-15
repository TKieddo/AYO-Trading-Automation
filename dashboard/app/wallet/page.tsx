import { ArrowDownUp, Coins, Wallet } from "lucide-react";
import { headers } from "next/headers";
import { getAsterEnv } from "@/lib/aster";
import { getHyperliquidEnv } from "@/lib/hyperliquid";

async function fetchBalances() {
  // Determine which exchange is configured (Aster takes priority)
  const asterEnv = getAsterEnv();
  const hyperliquidEnv = getHyperliquidEnv();
  const exchange = asterEnv ? "aster" : (hyperliquidEnv ? "hyperliquid" : null);
  
  // Get base URL - prefer environment variable, fallback to headers
  let base: string;
  try {
    // Try to get from environment variable first (most reliable)
    if (process.env.NEXT_PUBLIC_BASE_URL) {
      base = process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
    } else {
      // Fallback to headers if available
      const h = headers();
      // Check if headers() returns a Headers-like object
      if (h && typeof h.get === "function") {
        const host = h.get("host") || "localhost:3001";
        const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
        base = `${proto}://${host}`;
      } else {
        // Final fallback
        base = "http://localhost:3001";
      }
    }
  } catch (e) {
    // If headers() fails, use environment variable or default
    base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";
  }

  // Call the appropriate API endpoint based on configured exchange
  const apiEndpoint = exchange === "aster" 
    ? `${base}/api/aster/balances`
    : exchange === "hyperliquid"
    ? `${base}/api/hyperliquid/balances`
    : null;

  if (!apiEndpoint) {
    return { 
      balances: [], 
      error: "No exchange configured. Please set either Aster (ASTER_USER_ADDRESS, ASTER_SIGNER_ADDRESS, ASTER_PRIVATE_KEY) or Hyperliquid (HYPERLIQUID_WALLET_ADDRESS) credentials." 
    };
  }

  const resp = await fetch(apiEndpoint, { cache: "no-store" });
  try {
    const json = await resp.json();
    if (!resp.ok) return { balances: [], error: json?.error || `Request failed (${resp.status})`, exchange };
    return { ...json, exchange };
  } catch (e) {
    return { balances: [], error: "Failed to parse response", exchange };
  }
}

export default async function WalletPage() {
  const { balances, error, accountValue, debug, network, exchange } = await fetchBalances();
  
  // Calculate total based on exchange type
  // Both Aster and Hyperliquid now return accountValue from their APIs
  let total: number;
  if (accountValue != null && accountValue > 0) {
    // Use accountValue from API if available (preferred for both exchanges)
    total = accountValue;
  } else if (exchange === "aster") {
    // Fallback for Aster: sum crossWalletBalance from all balances (includes unrealized PnL)
    total = balances.reduce((acc: number, b: any) => acc + (Number(b.crossWalletBalance || b.walletBalance || 0) || 0), 0);
  } else {
    // Fallback for Hyperliquid: sum position values
    total = balances.reduce((acc: number, b: any) => acc + (Number(b.walletBalance || b.positionValue) || 0), 0);
  }
  
  // Get network from API response, fallback to env var if not present (only for Hyperliquid)
  const networkFromApi = network || process.env.HYPERLIQUID_NETWORK || "mainnet";
  const networkLabel = networkFromApi === "testnet" ? "Testnet" : "Mainnet";
  const exchangeName = exchange === "aster" ? "Aster" : "Hyperliquid";
  const exchangeLabel = exchange === "aster" 
    ? "Aster" 
    : `Hyperliquid (${networkLabel})`;

  // Filter balances to only show assets where Balance/Position is greater than 0
  const filteredBalances = balances.filter((b: any) => {
    // This matches the exact calculation used in the Balance/Position column
    const balancePosition = Number(b.positionValue || b.crossWalletBalance || b.walletBalance || 0);
    return balancePosition > 0;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Wallet className="h-6 w-6 text-slate-700" /> Wallet
        </h1>
        <p className="text-slate-600 mt-1">{exchangeName} balances and positions.</p>
      </div>

      <div className="rounded-2xl ring-1 ring-slate-200 bg-white/70 backdrop-blur p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="h-6 w-6 text-emerald-600" />
            <div>
              <div className="text-sm text-slate-600">Total Wallet Balance</div>
              <div className="text-2xl font-semibold text-slate-900">{total.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-slate-500">
            <ArrowDownUp className="h-5 w-5" />
            <span className="text-sm">
              {exchangeLabel}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 text-sm whitespace-pre-line">
          {String(error)}
        </div>
      )}

      {(debug || (total < 100 && exchange === "aster")) && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          <div className="font-semibold mb-2">Debug Info:</div>
          <div className="text-xs font-mono whitespace-pre-wrap">
            {debug ? (
              <>
                Account Value: {debug.accountValue || "0"}
                {"\n"}Total Wallet Balance: {debug.totalWalletBalance || "0"}
                {"\n"}Total Unrealized PnL: {debug.totalUnrealizedPnl || "0"}
                {"\n"}Withdrawable: {debug.withdrawable || "0"}
                {"\n"}Positions: {debug.positionsCount || "0"}
                {"\n"}Calculation Method: {debug.calculationMethod || "unknown"}
                {"\n"}Account Keys: {debug.accountKeys ? debug.accountKeys.join(", ") : "none"}
                {debug.rawAccount && (
                  <>
                    {"\n\n"}Raw Account Response:
                    {JSON.stringify(debug.rawAccount, null, 2)}
                  </>
                )}
                {debug.positions && debug.positions.length > 0 && (
                  <>
                    {"\n\n"}Positions (first 5):
                    {JSON.stringify(debug.positions, null, 2)}
                  </>
                )}
              </>
            ) : (
              "No debug info available"
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200 bg-white/70 backdrop-blur">
        <div className="grid grid-cols-12 px-4 py-3 text-sm font-medium text-slate-600">
          <div className="col-span-3">Asset</div>
          <div className="col-span-3 text-right">Balance/Position</div>
          <div className="col-span-3 text-right">Available</div>
          <div className="col-span-3 text-right">Unrealized PnL</div>
        </div>
        <div className="divide-y divide-slate-200">
          {filteredBalances.length === 0 && !error && (
            <div className="px-4 py-6 text-sm text-slate-500">No balances found.</div>
          )}
          {filteredBalances.map((b: any) => (
            <div key={b.asset} className="grid grid-cols-12 px-4 py-3 text-sm">
              <div className="col-span-3 font-medium text-slate-800">{b.asset}</div>
              <div className="col-span-3 text-right text-slate-900">
                {Number(b.positionValue || b.crossWalletBalance || b.walletBalance || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
              <div className="col-span-3 text-right text-slate-900">
                {Number(b.availableBalance || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
              <div className={`col-span-3 text-right ${Number(b.unrealizedPnl || b.crossUnPnl || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {Number(b.unrealizedPnl || b.crossUnPnl || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


