import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug logging (remove in production)
if (typeof window === 'undefined') {
  console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('Supabase Key:', supabaseAnonKey ? 'Set' : 'Missing');
}

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Supabase credentials missing: URL=${!supabaseUrl ? 'missing' : 'ok'}, Key=${!supabaseAnonKey ? 'missing' : 'ok'}. Please restart your dev server after setting environment variables in .env.local`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
