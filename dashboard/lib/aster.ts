/**
 * Aster Finance Futures API v3 Helper - Wallet-based Authentication
 * Uses the same authentication method as the Python trading agent (ECDSA signatures)
 * Documentation: https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api-v3.md
 */

import crypto from "crypto";
import { ethers } from "ethers";

const ASTER_BASE_URL = "https://fapi.asterdex.com";

export interface AsterEnv {
  userAddress: string; // Main wallet address
  signerAddress: string; // API wallet address
  privateKey: string; // API wallet private key
}

/**
 * Get Aster wallet configuration from environment variables
 * Uses the same credentials as the Python trading agent
 */
export function getAsterEnv(): AsterEnv | null {
  const userAddress = process.env.ASTER_USER_ADDRESS;
  const signerAddress = process.env.ASTER_SIGNER_ADDRESS;
  const privateKey = process.env.ASTER_PRIVATE_KEY;
  
  if (!userAddress || !signerAddress || !privateKey) {
    return null;
  }

  return { userAddress, signerAddress, privateKey };
}

/**
 * Convert all parameter values to strings (recursively)
 * Matches Python's _trim_dict function
 */
function trimDict(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      result[key] = JSON.stringify(value.map(item => 
        typeof item === 'object' ? trimDict(item) : String(item)
      ));
    } else if (typeof value === 'object') {
      result[key] = JSON.stringify(trimDict(value));
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

/**
 * Generate Aster ECDSA signature following v3 API specification
 * Matches Python's _generate_signature function
 */
async function generateSignature(
  params: Record<string, any>,
  nonce: number,
  userAddress: string,
  signerAddress: string,
  privateKey: string
): Promise<string> {
  // Step 1: Remove None values
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== null && v !== undefined)
  );

  // Step 2: Add timestamp and recvWindow if not present
  if (!cleanParams.timestamp) {
    cleanParams.timestamp = Math.round(Date.now());
  }
  if (!cleanParams.recvWindow) {
    cleanParams.recvWindow = 5000;
  }

  // Step 3: Convert all values to strings (recursively)
  const trimmed = trimDict(cleanParams);

  // Step 4: Generate JSON string sorted by ASCII keys, remove spaces and single quotes
  // Python: json.dumps(my_dict, sort_keys=True).replace(' ', '').replace("'", '"')
  // Create a new object with sorted keys
  const sortedKeys = Object.keys(trimmed).sort();
  const sortedObj: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = trimmed[key];
  }
  const jsonStr = JSON.stringify(sortedObj).replace(/\s/g, '').replace(/'/g, '"');
  
  // Step 5: ABI encode: ['string', 'address', 'address', 'uint256']
  const types = ['string', 'address', 'address', 'uint256'];
  const values = [jsonStr, userAddress, signerAddress, nonce];
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(types, values);
  
  // Step 6: Keccak hash
  const keccakHash = ethers.keccak256(encoded);
  
  // Step 7: Sign using encode_defunct (EIP-191) - matches Python's encode_defunct(hexstr=keccak_hex)
  // Python: encode_defunct(hexstr=keccak_hex) creates EIP-191 message from hex string
  // The format is: "\x19Ethereum Signed Message:\n" + len(bytes) + bytes
  // For a 32-byte keccak hash: "\x19Ethereum Signed Message:\n32" + 32_bytes
  const wallet = new ethers.Wallet(privateKey);
  
  // encode_defunct(hexstr=...) in Python converts hex to bytes, then creates EIP-191 message
  // We need to manually create: "\x19Ethereum Signed Message:\n32" + keccak_bytes
  const keccakBytes = ethers.getBytes(keccakHash);
  
  // EIP-191 format: prefix + length (as bytes, not string) + message
  // Actually, encode_defunct uses: "\x19Ethereum Signed Message:\n" + len_as_utf8_string + message_bytes
  // For 32 bytes: "\x19Ethereum Signed Message:\n32" + 32_bytes (no newline after 32)
  const prefix = "\x19Ethereum Signed Message:\n32";
  const prefixBytes = new Uint8Array(Buffer.from(prefix, "utf-8"));
  const messageBytes = new Uint8Array(keccakBytes);
  const eip191Message = new Uint8Array(prefixBytes.length + messageBytes.length);
  eip191Message.set(prefixBytes, 0);
  eip191Message.set(messageBytes, prefixBytes.length);
  
  // Hash the EIP-191 message, then sign
  const messageHash = ethers.keccak256(eip191Message);
  const sig = wallet.signingKey.sign(messageHash);
  
  // Step 8: Return signature with 0x prefix (r + s + v) - matches Python's .signature.hex()
  // Python: '0x' + signed_message.signature.hex()
  // The signature.hex() returns r + s + v as hex string
  return '0x' + sig.r.slice(2) + sig.s.slice(2) + sig.v.toString(16).padStart(2, '0');
}

/**
 * Make authenticated request to Aster API using wallet-based authentication
 */
export async function asterSignedGet(
  endpoint: string,
  params: Record<string, any> = {},
  env: AsterEnv
): Promise<any> {
  // Add timestamp and recvWindow
  const timestamp = Math.round(Date.now());
  const allParams = {
    ...params,
    timestamp,
    recvWindow: 5000,
  };

  // Generate nonce (microseconds) - matches Python: math.trunc(time.time() * 1000000)
  const nonce = Math.trunc(Date.now() * 1000);
  
  // Generate signature
  const signature = await generateSignature(
    allParams,
    nonce,
    env.userAddress,
    env.signerAddress,
    env.privateKey
  );
  
  // Add auth parameters
  const queryParams = new URLSearchParams();
  Object.entries(allParams).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });
  queryParams.append('nonce', String(nonce));
  queryParams.append('user', env.userAddress);
  queryParams.append('signer', env.signerAddress);
  queryParams.append('signature', signature);
  
  // Build URL
  const url = `${ASTER_BASE_URL}${endpoint}?${queryParams.toString()}`;

  // Make request with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for faster failure
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Next.js/1.0",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Aster API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Provide more detailed error messages
    if (error.name === 'AbortError') {
      throw new Error(`Aster API request timeout after 5 seconds: ${endpoint}`);
    } else if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      // Network error - could be DNS, connection, SSL, etc.
      throw new Error(`Aster API network error: Unable to connect to ${ASTER_BASE_URL}. Check your internet connection and API endpoint. Original error: ${error.message}`);
    } else if (error.message) {
      // Re-throw with original message if it's already descriptive
      throw error;
    } else {
      throw new Error(`Aster API request failed: ${error.toString()}`);
    }
  }
}

/**
 * Fetch user's account trade list from Aster API
 * Endpoint: GET /fapi/v3/userTrades
 * Uses wallet-based authentication (same as Python trading agent)
 */
export async function getAsterUserTrades(
  env: AsterEnv,
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
  if (options.limit) params.limit = options.limit;
  if (options.fromId) params.fromId = options.fromId;

  return asterSignedGet("/fapi/v3/userTrades", params, env);
}

/**
 * Fetch all orders from Aster API (open, filled, canceled, etc.)
 * Endpoint: GET /fapi/v3/allOrders
 * Uses wallet-based authentication (same as Python trading agent)
 */
export async function getAsterAllOrders(
  env: AsterEnv,
  options: {
    symbol?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    orderId?: number;
  } = {}
): Promise<any[]> {
  const params: Record<string, any> = {};
  
  if (options.symbol) params.symbol = options.symbol;
  if (options.startTime) params.startTime = options.startTime;
  if (options.endTime) params.endTime = options.endTime;
  if (options.limit) params.limit = options.limit;
  if (options.orderId) params.orderId = options.orderId;

  return asterSignedGet("/fapi/v3/allOrders", params, env);
    }

/**
 * Fetch current open orders from Aster API
 * Endpoint: GET /fapi/v3/openOrders
 * Uses wallet-based authentication (same as Python trading agent)
 */
export async function getAsterOpenOrders(
  env: AsterEnv,
  options: {
    symbol?: string;
  } = {}
): Promise<any[]> {
  const params: Record<string, any> = {};
  
  if (options.symbol) params.symbol = options.symbol;

  return asterSignedGet("/fapi/v3/openOrders", params, env);
}

/**
 * Fetch income history from Aster API
 * Endpoint: GET /fapi/v3/income (USER_DATA)
 * Documentation: https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api-v3.md#get-income-historyuser_data
 * Uses wallet-based authentication (same as Python trading agent)
 */
export async function getAsterIncomeHistory(
  env: AsterEnv,
  options: {
    symbol?: string;
    incomeType?: string; // TRANSFER, COMMISSION, FUNDING_FEE, REALIZED_PNL, etc.
    startTime?: number;
    endTime?: number;
    limit?: number;
  } = {}
): Promise<any[]> {
  const params: Record<string, any> = {};
  
  if (options.symbol) params.symbol = options.symbol;
  if (options.incomeType) params.incomeType = options.incomeType;
  if (options.startTime) params.startTime = options.startTime;
  if (options.endTime) params.endTime = options.endTime;
  if (options.limit) params.limit = options.limit;

  return asterSignedGet("/fapi/v3/income", params, env);
}
