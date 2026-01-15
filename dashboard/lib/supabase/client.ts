import { createClient } from '@supabase/supabase-js';

// Supabase is OPTIONAL - only create client if env vars are provided
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase not configured. Data will come from Python API only.');
}

export { supabase };

// Export a safe getter that returns null if not configured
export function getSupabase() {
  return supabase;
}

