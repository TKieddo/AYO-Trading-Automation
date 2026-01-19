/**
 * Binance Futures API Helper
 * Uses API key authentication (HMAC SHA256)
 * Documentation: https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/rest-api/Account-Trade-List
 */

import crypto from "crypto";

const BINANCE_BASE_URL = "https://fapi.binance.com";

export interface BinanceEnv {
  apiKey: string;
  apiSecret: string;
}

/**
 * Get Binance API configuration from environment variables
 */
export function getBinanceEnv(): BinanceEnv | null {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
}

/**
 * Create HMAC SHA256 signature for Binance API
 */
function createSignature(queryString: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(queryString).digest("hex");
}

/**
 * Make a signed request to Binance Futures API
 */
async function binanceSignedGet(
  endpoint: string,
  params: Record<string, any>,
  env: BinanceEnv
): Promise<any> {
  // Add timestamp
  const timestamp = Date.now();
  const queryParams = new URLSearchParams({
    ...params,
    timestamp: timestamp.toString(),
  });

  // Create signature
  const signature = createSignature(queryParams.toString(), env.apiSecret);
  queryParams.append("signature", signature);

  // Make request
  const url = `${BINANCE_BASE_URL}${endpoint}?${queryParams.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": env.apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Binance API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch user's trade list from Binance Futures API
 * Endpoint: GET /fapi/v1/userTrades
 * Includes realizedPnl for closed positions
 */
export async function getBinanceUserTrades(
  env: BinanceEnv,
  options: {
    symbol?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    fromId?: number;
  } = {}
): Promise<any[]> {
  const params: Record<string, any> = {};
  
  if (options.symbol) params.symbol = options.symbol;
  if (options.startTime) params.startTime = options.startTime;
  if (options.endTime) params.endTime = options.endTime;
  if (options.limit) params.limit = Math.min(options.limit, 1000); // Max 1000
  if (options.fromId) params.fromId = options.fromId;

  // If no time range specified, get last 7 days (Binance default)
  // We'll fetch for all trading symbols if symbol not specified
  // For now, if symbol is not specified, we need to fetch per symbol
  // But for simplicity, we'll require symbol or fetch for common symbols
  
  try {
    const trades = await binanceSignedGet("/fapi/v1/userTrades", params, env);
    return Array.isArray(trades) ? trades : [];
  } catch (error: any) {
    console.error("Error fetching Binance user trades:", error);
    throw error;
  }
}

/**
 * Fetch user trades for a single symbol
 * Binance API requires symbol parameter
 */
export async function getBinanceUserTradesForSymbol(
  env: BinanceEnv,
  symbol: string,
  options: {
    startTime?: number;
    endTime?: number;
    limit?: number;
    fromId?: number;
  } = {}
): Promise<any[]> {
  const binanceSymbol = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
  return getBinanceUserTrades(env, {
    ...options,
    symbol: binanceSymbol,
  });
}
