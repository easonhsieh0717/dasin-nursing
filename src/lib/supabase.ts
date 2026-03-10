import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabase = !!supabaseUrl && !!supabaseKey;

// Only create client when credentials are available to avoid build errors
export const supabase: SupabaseClient = isSupabase
  ? createClient(supabaseUrl, supabaseKey)
  : (null as unknown as SupabaseClient);
