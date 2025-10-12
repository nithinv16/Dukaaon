// Debug script to check seller_details table structure and data
// Run this with: node debug_seller_details.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function debugSellerDetails() {
  console.log('🔍 Debugging seller_details table...');
  
  try {
    // 1. Check if seller_details table exists by trying to query it
    console.log('\n1. Checking if seller_details table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('seller_details')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ seller_details table does not exist or is not accessible:');
      console.error('Error code:', tableError.code);
      console.error('Error message:', tableError.message);
      return;
    }
    
    console.log('✅ seller_details table exists and is accessible');
    
    // 2. Check table structure by examining a sample record
    console.log('\n2. Checking table structure...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('seller_details')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error fetching sample data:', sampleError.message);
    } else if (sampleData && sampleData.length > 0) {
      console.log('✅ Sample record found. Table columns:');
      const columns = Object.keys(sampleData[0]);
      columns.forEach(col => {
        console.log(`  - ${col}: ${typeof sampleData[0][col]} (${sampleData[0][col] !== null ? 'has value' : 'null'})`);
      });
      
      // Check specifically for business_name and owner_name
      const hasBusinessName = columns.includes('business_name');
      const hasOwnerName = columns.includes('owner_name');
      
      console.log('\n📋 Required columns check:');
      console.log(`  business_name: ${hasBusinessName ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`  owner_name: ${hasOwnerName ? '✅ EXISTS' : '❌ MISSING'}`);
      
      if (hasBusinessName) {
        console.log(`  business_name value: "${sampleData[0].business_name}"`);
      }
      if (hasOwnerName) {
        console.log(`  owner_name value: "${sampleData[0].owner_name}"`);
      }
    } else {
      console.log('⚠️ Table exists but has no records');
      
      // Try to get table structure using information_schema
      console.log('\n3. Attempting to get table structure from information_schema...');
      const { data: schemaData, error: schemaError } = await supabase
        .rpc('get_table_columns', { table_name: 'seller_details' });
      
      if (schemaError) {
        console.log('❌ Could not get schema information:', schemaError.message);
      } else {
        console.log('✅ Table structure:', schemaData);
      }
    }
    
    // 3. Count total records
    console.log('\n3. Counting total records...');
    const { count, error: countError } = await supabase
      .from('seller_details')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting records:', countError.message);
    } else {
      console.log(`✅ Total records in seller_details: ${count}`);
    }
    
    // 4. Check for specific user if provided
    if (process.argv[2]) {
      const userId = process.argv[2];
      console.log(`\n4. Checking seller_details for user ID: ${userId}`);
      
      const { data: userData, error: userError } = await supabase
        .from('seller_details')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (userError) {
        if (userError.code === 'PGRST116') {
          console.log('❌ No seller_details record found for this user');
        } else {
          console.error('❌ Error fetching user data:', userError.message);
        }
      } else {
        console.log('✅ User seller_details found:');
        console.log('  business_name:', userData.business_name);
        console.log('  owner_name:', userData.owner_name);
        console.log('  seller_type:', userData.seller_type);
        console.log('  image_url:', userData.image_url);
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

// Run the debug function
debugSellerDetails().then(() => {
  console.log('\n🏁 Debug completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

// Usage:
// node debug_seller_details.js
// or with user ID:
// node debug_seller_details.js <user-id>