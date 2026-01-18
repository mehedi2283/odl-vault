import { createClient } from '@supabase/supabase-js';

// Defensive check: Ensure env object exists before accessing properties
const env = (import.meta as any).env || {};

// Use the URL provided in the prompt as a fallback if the env var is missing
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://qqxdfqerllirceqiwyex.supabase.co';
// Use the provided key as fallback to allow client initialization
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MkJA39ZFUY8Wvu0DTwP9Yw_y_kfFiEm';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase configuration missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);