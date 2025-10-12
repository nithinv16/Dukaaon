const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
  console.log('🔍 Running Supabase Database Diagnostics...\n');
  
  try {
    // Check profiles table structure
    console.log('1. Checking profiles table structure:');
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profileError) {
      console.log('❌ Error accessing profiles table:', profileError.message);
      console.log('Error code:', profileError.code);
      console.log('Error details:', profileError.details);
    } else {
      console.log('✅ Profiles table accessible');
      if (profiles && profiles.length > 0) {
        console.log('Available columns:', Object.keys(profiles[0]));
      } else {
        console.log('Table is empty, checking with describe...');
      }
    }
    
    // Test profile creation with minimal data
    console.log('\n2. Testing minimal profile creation:');
    const testUserId = 'test-' + Date.now();
    const { data: createResult, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: testUserId,
        phone_number: '+1234567890'
      })
      .select();
    
    if (createError) {
      console.log('❌ Profile creation failed:', createError.message);
      console.log('Error code:', createError.code);
      console.log('Error details:', createError.details);
      console.log('Error hint:', createError.hint);
    } else {
      console.log('✅ Profile creation successful');
      console.log('Created profile:', createResult);
      
      // Clean up test data
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', testUserId);
      
      if (deleteError) {
        console.log('⚠️ Failed to clean up test data:', deleteError.message);
      } else {
        console.log('✅ Test data cleaned up');
      }
    }
    
    // Test profile creation with all fields
    console.log('\n3. Testing full profile creation:');
    const testUserId2 = 'test-full-' + Date.now();
    const { data: createResult2, error: createError2 } = await supabase
      .from('profiles')
      .insert({
        id: testUserId2,
        phone_number: '+1234567891',
        role: 'retailer',
        language: 'en',
        status: 'active'
      })
      .select();
    
    if (createError2) {
      console.log('❌ Full profile creation failed:', createError2.message);
      console.log('Error code:', createError2.code);
      console.log('Error details:', createError2.details);
    } else {
      console.log('✅ Full profile creation successful');
      
      // Clean up test data
      await supabase.from('profiles').delete().eq('id', testUserId2);
      console.log('✅ Test data cleaned up');
    }
    
    // Check RLS policies
    console.log('\n4. Testing RLS policies:');
    const { data: rlsTest, error: rlsError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (rlsError) {
      console.log('❌ RLS policy issue:', rlsError.message);
    } else {
      console.log('✅ RLS policies allow read access');
    }
    
    console.log('\n🎯 Diagnostic Summary:');
    console.log('- Check the error messages above to identify the root cause');
    console.log('- Look for constraint violations, missing columns, or RLS issues');
    console.log('- The error during OTP signup is likely one of the issues found above');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

runDiagnostics().then(() => {
  console.log('\n✅ Diagnostics completed');
}).catch(error => {
  console.error('❌ Diagnostics failed:', error);
  process.exit(1);
});