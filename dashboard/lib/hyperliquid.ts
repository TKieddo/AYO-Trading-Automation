export type HyperliquidEnv = {
  baseUrl: string; // https://api.hyperliquid.xyz or testnet
  walletAddress: string; // Wallet address (0x...)
};

export function getHyperliquidEnv(): HyperliquidEnv | null {
  // Support testnet via env var or default to mainnet
  const networkRaw = process.env.HYPERLIQUID_NETWORK;
  const network = networkRaw?.toLowerCase().trim() || "mainnet";
  const customBase = process.env.HYPERLIQUID_API_BASE;
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === "development") {
    console.log(`[getHyperliquidEnv] HYPERLIQUID_NETWORK raw: "${networkRaw}", processed: "${network}"`);
  }
  
  let baseUrl: string;
  if (customBase) {
    baseUrl = customBase.replace(/\/$/, "");
  } else if (network === "testnet") {
    baseUrl = "https://api.hyperliquid-testnet.xyz";
  } else {
    baseUrl = "https://api.hyperliquid.xyz";
  }
  
  const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
  
  if (!walletAddress) return null;
  return { baseUrl, walletAddress };
}

/**
 * Query Hyperliquid Info API
 */
async function hyperliquidQuery(baseUrl: string, type: string, user?: string, additionalParams?: any) {
  const url = `${baseUrl}/info`;
  const body: any = { type };
  if (user) {
    body.user = user;
  }
  if (additionalParams) {
    Object.assign(body, additionalParams);
  }
  
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Hyperliquid ${resp.status}: ${text}`);
  }
  
  const json = await resp.json();
  // Hyperliquid returns data directly or wrapped in response.data
  return json?.data || json;
}

/**
 * Get user state (balances, positions, account value)
 */
export async function getHyperliquidUserState(env: HyperliquidEnv) {
  // Try the correct endpoint - Hyperliquid uses "clearinghouseState" with user address
  const data = await hyperliquidQuery(env.baseUrl, "clearinghouseState", env.walletAddress);
  
  // Debug: log the response structure (only in development)
  if (process.env.NODE_ENV === "development") {
    console.log("Hyperliquid API response:", JSON.stringify(data, null, 2));
  }
  
  // Handle different response structures
  // Response might be directly the data, or wrapped
  const accountValue = data?.accountValue || data?.marginSummary?.accountValue || "0";
  const withdrawable = data?.withdrawable || data?.marginSummary?.withdrawable || "0";
  const assetPositions = data?.assetPositions || [];
  
  return {
    accountValue: parseFloat(String(accountValue)),
    withdrawable: parseFloat(String(withdrawable)),
    assetPositions,
    marginSummary: data?.marginSummary || {},
    rawData: data, // Include for debugging
  };
}

/**
 * Get all asset balances
 */
export async function getHyperliquidBalances(env: HyperliquidEnv) {
  const state = await getHyperliquidUserState(env);
  
  // Extract balances from positions and account
  const balances: Array<{
    asset: string;
    walletBalance: number;
    availableBalance: number;
    positionValue: number;
    positionSize?: number; // Actual position size (for quantity display)
    unrealizedPnl: number;
  }> = [];
  
  // Add USDC balance (withdrawable is typically in USDC)
  if (state.withdrawable > 0) {
    balances.push({
      asset: "USDC",
      walletBalance: state.withdrawable,
      availableBalance: state.withdrawable,
      positionValue: 0,
      unrealizedPnl: 0,
    });
  }
  
  // Add position balances
  for (const posWrap of state.assetPositions || []) {
    const pos = posWrap.position || posWrap;
    const coin = pos.coin || "UNKNOWN";
    const size = parseFloat(pos.szi || "0");
    const entryPx = parseFloat(pos.entryPx || "0");
    const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
    
    // Calculate position value
    const positionValue = Math.abs(size * entryPx);
    
    balances.push({
      asset: coin,
      walletBalance: positionValue,
      availableBalance: 0, // Positions aren't "available" - they're locked in positions
      positionValue,
      positionSize: size, // Include actual position size for quantity calculation
      unrealizedPnl,
    });
  }
  
  return { balances, state };
}

/**
 * Get user fills (trades) from Hyperliquid
 * Hyperliquid Info API endpoint: POST /info with type "userFills" and user address
 */
export async function getHyperliquidUserFills(env: HyperliquidEnv, limit: number = 1000) {
  try {
    // Hyperliquid uses "userFills" type with user address
    const data = await hyperliquidQuery(env.baseUrl, "userFills", env.walletAddress);
    
    // Debug logging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.log("Hyperliquid userFills response:", JSON.stringify(data, null, 2));
    }
    
    // Hyperliquid returns fills as an array directly
    if (Array.isArray(data)) {
      // Return most recent fills (limit), sorted by time (newest first)
      const sorted = data.sort((a: any, b: any) => {
        const timeA = Number(a.time || a.timestamp || 0);
        const timeB = Number(b.time || b.timestamp || 0);
        return timeB - timeA; // Descending
      });
      return sorted.slice(0, limit);
    }
    
    // Sometimes it's wrapped in a structure
    if (data?.fills && Array.isArray(data.fills)) {
      const sorted = data.fills.sort((a: any, b: any) => {
        const timeA = Number(a.time || a.timestamp || 0);
        const timeB = Number(b.time || b.timestamp || 0);
        return timeB - timeA; // Descending
      });
      return sorted.slice(0, limit);
    }
    
    // If it's a single object, wrap it in an array
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return [data].slice(0, limit);
    }
    
    return [];
  } catch (err: any) {
    console.error("Error fetching Hyperliquid fills:", err);
    return [];
  }
}

/**
 * Get open orders from Hyperliquid
 * Hyperliquid Info API endpoint: POST /info with type "openOrders" or "frontendOpenOrders"
 */
export async function getHyperliquidOpenOrders(env: HyperliquidEnv) {
  try {
    // Try "frontendOpenOrders" first (used by Python SDK)
    let data = await hyperliquidQuery(env.baseUrl, "frontendOpenOrders", env.walletAddress);
    
    // If that doesn't work, try "openOrders"
    if (!data || (Array.isArray(data) && data.length === 0)) {
      data = await hyperliquidQuery(env.baseUrl, "openOrders", env.walletAddress);
    }
    
    // Debug logging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.log("Hyperliquid openOrders response:", JSON.stringify(data, null, 2));
    }
    
    // Hyperliquid returns orders as an array
    if (Array.isArray(data)) {
      return data;
    }
    
    // Sometimes it's wrapped
    if (data?.orders && Array.isArray(data.orders)) {
      return data.orders;
    }
    
    return [];
  } catch (err: any) {
    console.error("Error fetching Hyperliquid open orders:", err);
    return [];
  }
}

/**
 * Get order status for specific order IDs
 * Hyperliquid Info API endpoint: POST /info with type "orderStatus"
 * Body: { type: "orderStatus", user: address, oids: [orderId1, orderId2, ...] }
 */
export async function getHyperliquidOrderStatus(env: HyperliquidEnv, orderIds: string[]) {
  try {
    if (!orderIds || orderIds.length === 0) return [];
    
    // Hyperliquid orderStatus endpoint - batch query up to reasonable limit
    // Split into batches if too many (e.g., 100 at a time)
    const batchSize = 100;
    const batches: string[][] = [];
    for (let i = 0; i < orderIds.length; i += batchSize) {
      batches.push(orderIds.slice(i, i + batchSize));
    }
    
    const allStatuses: any[] = [];
    
    for (const batch of batches) {
      try {
        const url = `${env.baseUrl}/info`;
        const body = {
          type: "orderStatus",
          user: env.walletAddress,
          oids: batch,
        };
        
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        
        if (!resp.ok) {
          console.warn(`Hyperliquid orderStatus batch failed: ${resp.status}`);
          continue;
        }
        
        const json = await resp.json();
        const data = json?.data || json;
        
        // Hyperliquid returns array of status objects: [{ oid, status: { resting | filled | cancelled | error } }]
        if (Array.isArray(data)) {
          allStatuses.push(...data);
        } else if (data?.statuses && Array.isArray(data.statuses)) {
          allStatuses.push(...data.statuses);
        }
      } catch (batchErr) {
        console.warn("Error fetching order status batch:", batchErr);
        continue;
      }
    }
    
    // Debug logging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.log(`Hyperliquid orderStatus response (${allStatuses.length} statuses):`, JSON.stringify(allStatuses.slice(0, 5), null, 2));
    }
    
    return allStatuses;
  } catch (err: any) {
    console.error("Error fetching Hyperliquid order status:", err);
    return [];
  }
}

/**
 * Get user fills (trades) with order status information
 * This includes orders that were filled, rejected, canceled, or triggered
 */
export async function getHyperliquidUserFillsWithStatus(env: HyperliquidEnv, limit: number = 1000) {
  try {
    // Get fills first
    const fills = await getHyperliquidUserFills(env, limit);
    
    // Extract unique order IDs from fills
    const orderIds = new Set<string>();
    fills.forEach((fill: any) => {
      if (fill.oid) orderIds.add(String(fill.oid));
    });
    
    // Get order statuses for all order IDs
    const orderStatuses = orderIds.size > 0 
      ? await getHyperliquidOrderStatus(env, Array.from(orderIds))
      : [];
    
    // Create a map of order ID to status
    const statusMap = new Map<string, any>();
    orderStatuses.forEach((status: any) => {
      if (status.oid) {
        statusMap.set(String(status.oid), status);
      }
    });
    
    // Combine fills with status information
    return fills.map((fill: any) => {
      const orderId = String(fill.oid || "");
      const status = statusMap.get(orderId);
      return {
        ...fill,
        orderStatus: status?.status || status?.resting || status?.filled || status?.cancelled || null,
      };
    });
  } catch (err: any) {
    console.error("Error fetching Hyperliquid fills with status:", err);
    // Fallback to just fills if status lookup fails
    return await getHyperliquidUserFills(env, limit);
  }
}

