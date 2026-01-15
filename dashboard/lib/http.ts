export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(input, { ...rest, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchJsonWithRetry<T = any>(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
  retries = 2,
  backoffMs = 300
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetchWithTimeout(input, init);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.json()) as T;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

export function resolveBaseUrl(envValue: string | undefined, fallback: string) {
  const raw = envValue?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return fallback.replace(/\/$/, "");
}

// Simple in-memory cache for API route fallbacks
type CacheEntry = { value: any; expiresAt: number };
const apiCache = new Map<string, CacheEntry>();

export function cacheGet<T = any>(key: string): T | null {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    apiCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet(key: string, value: any, ttlMs = 5000) {
  apiCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}


