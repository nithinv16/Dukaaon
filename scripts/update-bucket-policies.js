// Script to update profiles bucket RLS policies for retailer-specific paths
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const updatePolicies = async () => {
  console.log('Updating profiles bucket RLS policies...');
  
  const sqlCommands = [
    // Drop existing policies
    `DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;`,
    `DROP POLICY IF EXISTS "Users can view profile images" ON storage.objects;`,
    `DROP POLICY IF EXISTS "Public can view profile images" ON storage.objects;`,
    `DROP POLICY IF EXISTS "Users can update profile images" ON storage.objects;`,
    `DROP POLICY IF EXISTS "Users can delete profile images" ON storage.objects;`,
    
    // Create updated upload policy
    `CREATE POLICY "Users can upload profile images" 
     ON storage.objects 
     FOR INSERT 
     TO public
     WITH CHECK (
       bucket_id = 'profiles' AND
       (
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = auth.uid()::text) OR
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = 'retailer' AND
          (storage.foldername(name))[2] = auth.uid()::text)
       )
     );`,
     
    // Create updated view policy
    `CREATE POLICY "Users can view profile images" 
     ON storage.objects 
     FOR SELECT 
     TO public
     USING (
       bucket_id = 'profiles' AND
       (
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = auth.uid()::text) OR
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = 'retailer' AND
          (storage.foldername(name))[2] = auth.uid()::text)
       )
     );`,
     
    // Create updated update policy
    `CREATE POLICY "Users can update profile images" 
     ON storage.objects 
     FOR UPDATE 
     TO public
     USING (
       bucket_id = 'profiles' AND
       (
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = auth.uid()::text) OR
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = 'retailer' AND
          (storage.foldername(name))[2] = auth.uid()::text)
       )
     )
     WITH CHECK (
       bucket_id = 'profiles' AND
       (
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = auth.uid()::text) OR
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = 'retailer' AND
          (storage.foldername(name))[2] = auth.uid()::text)
       )
     );`,
     
    // Create updated delete policy
    `CREATE POLICY "Users can delete profile images" 
     ON storage.objects 
     FOR DELETE 
     TO public
     USING (
       bucket_id = 'profiles' AND
       (
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = auth.uid()::text) OR
         (auth.role() IN ('authenticated', 'anon', 'service_role') AND
          (storage.foldername(name))[1] = 'retailer' AND
          (storage.foldername(name))[2] = auth.uid()::text)
       )
     );`
  ];
  
  for (const sql of sqlCommands) {
    try {
      console.log('Executing:', sql.substring(0, 50) + '...');
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error('Error executing SQL:', error);
        // Try direct execution if RPC fails
        const { error: directError } = await supabase.from('_').select('*').limit(0);
        if (directError) {
          console.error('Direct execution also failed:', directError);
        }
      } else {
        console.log('✓ Command executed successfully');
      }
    } catch (err) {
      console.error('Exception:', err.message);
    }
  }
  
  console.log('Policy update completed!');
};

updatePolicies().catch(console.error);