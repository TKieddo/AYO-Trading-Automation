import { createClient } from '@supabase/supabase-js';

let serverClient: ReturnType<typeof createClient> | null = null;

export function getServerSupabase() {
  if (serverClient) return serverClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  serverClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'dashboard-server' } },
  });
  return serverClient;
}


