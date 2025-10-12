const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function runDiagnostics() {
  console.log('=== PROFILE CREATION DIAGNOSTICS ===\n');
  
  try {
    // Test 1: Check if diagnostic function exists and works
    console.log('1. Testing diagnostic function...');
    const { data: diagResult, error: diagError } = await supabase.rpc(
      'diagnose_profile_creation',
      {
        phone_number: '9876543210',
        user_role: 'seller'
      }
    );
    
    if (diagError) {
      console.error('Diagnostic function error:', diagError);
    } else {
      console.log('Diagnostic result: Success -', diagResult ? 'Data received' : 'No data');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Try to create a profile with create_profile_unified
    console.log('2. Testing create_profile_unified function...');
    const testPhone = '9876543210';
    const { data: createResult, error: createError } = await supabase.rpc(
      'create_profile_unified',
      {
        phone_number: testPhone,
        user_role: 'seller'
      }
    );
    
    if (createError) {
      console.error('Profile creation error:', createError);
      console.error('Error details:', {
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code
      });
    } else {
      console.log('Profile creation result: Success -', createResult ? 'Profile created' : 'No result');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Check auth.users table state
    console.log('3. Checking auth.users table...');
    const { data: authUsers, error: authError } = await supabase
      .from('auth.users')
      .select('id, phone, email, created_at')
      .limit(5);
    
    if (authError) {
      console.error('Auth users query error:', authError);
    } else {
      console.log('Recent auth.users entries:', authUsers?.length || 0);
      if (authUsers && authUsers.length > 0) {
        console.log('Sample:', authUsers[0]);
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 4: Check profiles table state
    console.log('4. Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone_number, role, status, created_at')
      .limit(5);
    
    if (profilesError) {
      console.error('Profiles query error:', profilesError);
    } else {
      console.log('Recent profiles entries:', profiles?.length || 0);
      if (profiles && profiles.length > 0) {
        console.log('Sample:', profiles[0]);
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 5: Check for orphaned profiles (profiles without auth.users)
    console.log('5. Checking for orphaned profiles...');
    const { data: orphanedProfiles, error: orphanError } = await supabase
      .rpc('diagnose_profile_creation', {
        phone_number: '0000000000', // dummy phone to get general info
        user_role: 'retailer'
      });
    
    if (orphanError) {
      console.error('Orphaned profiles check error:', orphanError);
    } else {
      console.log('Database state info:', {
        profiles_table_exists: orphanedProfiles?.profiles_table_exists,
        auth_users_table_exists: orphanedProfiles?.auth_users_table_exists,
        profile_count: orphanedProfiles?.profile_count,
        auth_user_count: orphanedProfiles?.auth_user_count
      });
    }
    
  } catch (error) {
    console.error('Diagnostic script error:', error);
  }
}

// Run diagnostics
runDiagnostics().then(() => {
  console.log('\n=== DIAGNOSTICS COMPLETE ===');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});