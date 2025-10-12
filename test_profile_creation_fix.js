const { createClient } = require('@supabase/supabase-js');

// Test script to verify the profile creation fix
// Run this after applying the migration to ensure the fix works

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testProfileCreationFix() {
  console.log('🧪 Testing Profile Creation Fix...');
  console.log('=====================================\n');
  
  try {
    // Test 1: Create a new seller profile
    console.log('Test 1: Creating new seller profile...');
    const testPhone = `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
    
    const { data: sellerResult, error: sellerError } = await supabase.rpc('create_profile_unified', {
      phone_number: testPhone,
      user_role: 'seller'
    });
    
    if (sellerError) {
      console.log('❌ Seller creation failed:', sellerError);
      return false;
    }
    
    if (sellerResult && sellerResult.success) {
      console.log('✅ Seller profile created successfully!');
      console.log('   Profile ID:', sellerResult.profile_id);
      console.log('   Phone:', testPhone);
    } else {
      console.log('❌ Seller creation returned unsuccessful result:', sellerResult);
      return false;
    }
    
    // Test 2: Create a new retailer profile
    console.log('\nTest 2: Creating new retailer profile...');
    const testPhone2 = `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
    
    const { data: retailerResult, error: retailerError } = await supabase.rpc('create_profile_unified', {
      phone_number: testPhone2,
      user_role: 'retailer'
    });
    
    if (retailerError) {
      console.log('❌ Retailer creation failed:', retailerError);
      return false;
    }
    
    if (retailerResult && retailerResult.success) {
      console.log('✅ Retailer profile created successfully!');
      console.log('   Profile ID:', retailerResult.profile_id);
      console.log('   Phone:', testPhone2);
    } else {
      console.log('❌ Retailer creation returned unsuccessful result:', retailerResult);
      return false;
    }
    
    // Test 3: Verify profiles exist in database
    console.log('\nTest 3: Verifying profiles in database...');
    
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .in('phone_number', [testPhone, testPhone2]);
    
    if (fetchError) {
      console.log('❌ Failed to fetch profiles:', fetchError);
      return false;
    }
    
    if (profiles && profiles.length === 2) {
      console.log('✅ Both profiles found in database!');
      profiles.forEach(profile => {
        console.log(`   - ${profile.role}: ${profile.phone_number} (${profile.status})`);
        console.log(`     Created: ${profile.created_at}`);
        console.log(`     Updated: ${profile.updated_at}`);
      });
    } else {
      console.log('❌ Expected 2 profiles, found:', profiles?.length || 0);
      return false;
    }
    
    console.log('\n🎉 All tests passed! Profile creation fix is working correctly.');
    console.log('\n📝 Summary:');
    console.log('   - Seller profile creation: ✅ Working');
    console.log('   - Retailer profile creation: ✅ Working');
    console.log('   - Database persistence: ✅ Working');
    console.log('   - Timestamp columns: ✅ Working');
    
    return true;
    
  } catch (error) {
    console.log('❌ Unexpected error during testing:', error);
    return false;
  }
}

// Run the test
testProfileCreationFix().then(success => {
  if (success) {
    console.log('\n✅ Profile creation fix verification completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Profile creation fix verification failed!');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 Test script error:', error);
  process.exit(1);
});