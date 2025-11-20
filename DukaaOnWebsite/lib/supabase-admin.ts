import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseServiceKey) {
  console.error('⚠️  SUPABASE_SERVICE_ROLE_KEY is not set!');
  console.error('⚠️  Get it from: Supabase Dashboard → Settings → API → service_role key');
  console.error('⚠️  Add it to your .env.local file');
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Check console for instructions.');
}

// Admin client with service role key - bypasses RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
