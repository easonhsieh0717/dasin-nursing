import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

// Fail fast in production if service key is missing
if (process.env.NODE_ENV === 'production' && supabaseUrl && !supabaseKey) {
  throw new Error('FATAL: SUPABASE_SERVICE_KEY is required in production. Do not use anon key for server-side operations.');
}

export const isSupabase = !!supabaseUrl && !!supabaseKey;

// Only create client when credentials are available to avoid build errors
export const supabase: SupabaseClient = isSupabase
  ? createClient(supabaseUrl, supabaseKey)
  : (null as unknown as SupabaseClient);
