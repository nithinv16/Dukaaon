const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUUIDCreation() {
  console.log('🔍 Testing UUID Creation and Profile Insertion...\n');
  
  try {
    // Test 1: Create profile with a proper UUID (simulating Supabase Auth UUID)
    console.log('1. Testing with proper UUID format:');
    const properUUID = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID v4 format
    
    const { data: result1, error: error1 } = await supabase
      .from('profiles')
      .insert({
        id: properUUID,
        phone_number: '+1234567890',
        role: 'retailer',
        language: 'en'
      })
      .select();
    
    if (error1) {
      console.log('❌ Proper UUID failed:', error1.message);
      console.log('Error code:', error1.code);
      console.log('Error details:', error1.details);
    } else {
      console.log('✅ Proper UUID succeeded');
      
      // Clean up
      await supabase.from('profiles').delete().eq('id', properUUID);
      console.log('✅ Cleaned up test data');
    }
    
    // Test 2: Check what happens when we try to get a user from auth
    console.log('\n2. Testing current auth user:');
    const { data: authUser, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('❌ No authenticated user:', authError.message);
    } else if (authUser.user) {
      console.log('✅ Found authenticated user:', authUser.user.id);
      console.log('User ID format:', typeof authUser.user.id, authUser.user.id.length);
      
      // Test if this user ID can be used for profile creation
      const testId = authUser.user.id + '_test';
      console.log('\n3. Testing with real auth user ID format:');
      
      const { data: result2, error: error2 } = await supabase
        .from('profiles')
        .insert({
          id: authUser.user.id, // Use the actual auth user ID
          phone_number: '+1234567891',
          role: 'retailer',
          language: 'en'
        })
        .select();
      
      if (error2) {
        console.log('❌ Real auth UUID failed:', error2.message);
        console.log('Error code:', error2.code);
        
        // Check if profile already exists
        const { data: existing, error: existingError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.user.id)
          .single();
        
        if (existingError) {
          console.log('❌ Error checking existing profile:', existingError.message);
        } else if (existing) {
          console.log('ℹ️ Profile already exists for this user');
        }
      } else {
        console.log('✅ Real auth UUID succeeded');
        // Don't clean up - this might be a real user profile
      }
    } else {
      console.log('ℹ️ No authenticated user found');
    }
    
    // Test 3: Check if there are any database triggers that might be interfering
    console.log('\n4. Testing trigger behavior:');
    console.log('Checking if any triggers are automatically creating profiles...');
    
    // Try to create a profile and see what happens
    const testUUID2 = '550e8400-e29b-41d4-a716-446655440001';
    const { data: result3, error: error3 } = await supabase
      .from('profiles')
      .insert({
        id: testUUID2,
        phone_number: '+1234567892'
        // Minimal data to see what gets auto-populated
      })
      .select();
    
    if (error3) {
      console.log('❌ Minimal profile creation failed:', error3.message);
      console.log('This suggests the issue is with required fields or constraints');
    } else {
      console.log('✅ Minimal profile creation succeeded');
      console.log('Auto-populated fields:', result3[0]);
      
      // Clean up
      await supabase.from('profiles').delete().eq('id', testUUID2);
    }
    
    console.log('\n🎯 Test Summary:');
    console.log('- UUID format validation completed');
    console.log('- Check the errors above to identify the exact issue');
    console.log('- The OTP signup error is likely related to one of these constraint issues');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testUUIDCreation().then(() => {
  console.log('\n✅ UUID tests completed');
}).catch(error => {
  console.error('❌ UUID tests failed:', error);
  process.exit(1);
});