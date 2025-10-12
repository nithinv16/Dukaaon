// Simple test to verify Supabase connection and seller data
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSellersQuery() {
  console.log('Testing Supabase connection and seller queries...');
  
  try {
    // Test 1: Check seller_details table
    console.log('\n=== Test 1: Check seller_details table ===');
    const { data: sellerDetails, error: sellerDetailsError } = await supabase
      .from('seller_details')
      .select('*')
      .limit(5);
    
    if (sellerDetailsError) {
      console.error('Seller details query error:', sellerDetailsError);
    } else {
      console.log('Seller details found:', sellerDetails?.length || 0);
      console.log('Sample seller detail:', sellerDetails?.[0] || 'None');
    }
    
    // Test 2: Check products table
    console.log('\n=== Test 2: Check products table ===');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(5);
    
    if (productsError) {
      console.error('Products query error:', productsError);
    } else {
      console.log('Products found:', products?.length || 0);
      console.log('Sample product:', products?.[0] || 'None');
    }
    
    // Test 3: Test the relationship between seller_details and products
    console.log('\n=== Test 3: Test seller_details with products relationship ===');
    const { data: sellersWithProducts, error: relationError } = await supabase
      .from('seller_details')
      .select(`
        *,
        products (
          id,
          name,
          category,
          price,
          description
        )
      `)
      .limit(10);
    
    if (relationError) {
      console.error('Relationship query error:', relationError);
    } else {
      console.log('Sellers with products found:', sellersWithProducts?.length || 0);
      console.log('Sample seller with products:', sellersWithProducts?.[0] || 'None');
    }
    
    // Test 4: Test filtering by role if it exists
    console.log('\n=== Test 4: Test filtering by role ===');
    const { data: sellersByRole, error: roleError } = await supabase
      .from('seller_details')
      .select('*')
      .eq('role', 'seller')
      .limit(5);
    
    if (roleError) {
      console.error('Role filter error:', roleError);
    } else {
      console.log('Sellers by role found:', sellersByRole?.length || 0);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSellersQuery().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});

testSellersQuery().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});