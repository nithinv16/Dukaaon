const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://ybpjuvsqkqtjqzlqzqzq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicGp1dnNxa3F0anF6bHF6cXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1OTQ4NzQsImV4cCI6MjA1MDE3MDg3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCustomersData() {
  try {
    console.log('=== DEBUGGING CUSTOMERS SCREEN DATA ===\n');
    
    // 1. Check orders table structure and data
    console.log('1. Checking orders table...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(5);
    
    if (ordersError) {
      console.error('Error accessing orders table:', ordersError.message);
    } else {
      console.log(`✓ Orders table accessible. Found ${orders.length} sample records`);
      if (orders.length > 0) {
        console.log('Sample order:', orders[0]);
      }
    }
    
    // 2. Get total count of orders
    const { count: orderCount, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting orders:', countError.message);
    } else {
      console.log(`Total orders in database: ${orderCount}`);
    }
    
    // 3. Check profiles table for retailer data
    console.log('\n2. Checking profiles table for retailer data...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, business_details, phone_number, status, role')
      .eq('role', 'retailer')
      .limit(5);
    
    if (profilesError) {
      console.error('Error accessing profiles table:', profilesError.message);
    } else {
      console.log(`✓ Found ${profiles.length} retailer profiles`);
      if (profiles.length > 0) {
        console.log('Sample retailer profile:', profiles[0]);
      }
    }
    
    // 4. Check the exact query used by customers screen
    console.log('\n3. Testing the exact customers screen query...');
    
    // First, let's see if there are any seller_details records to get a seller_id
    const { data: sellers, error: sellersError } = await supabase
      .from('seller_details')
      .select('user_id')
      .limit(1);
    
    if (sellersError) {
      console.error('Error getting seller data:', sellersError.message);
      return;
    }
    
    if (sellers.length === 0) {
      console.log('❌ No sellers found in seller_details table');
      return;
    }
    
    const sellerId = sellers[0].user_id;
    console.log(`Using seller ID: ${sellerId}`);
    
    // Now test the exact query from customers screen
    const { data: customerOrders, error: customerError } = await supabase
      .from('orders')
      .select(`
        id,
        retailer_id,
        total_amount,
        created_at,
        retailer:retailer_id (
          business_details,
          phone_number,
          status
        )
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });
    
    if (customerError) {
      console.error('Error with customers query:', customerError.message);
    } else {
      console.log(`✓ Customer orders query successful. Found ${customerOrders.length} orders`);
      if (customerOrders.length > 0) {
        console.log('Sample customer order:', customerOrders[0]);
        console.log('Retailer data:', customerOrders[0].retailer);
      } else {
        console.log('❌ No orders found for this seller');
      }
    }
    
    // 5. Check if there are orders but with different seller_ids
    console.log('\n4. Checking all orders with seller_id...');
    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select('seller_id, retailer_id, total_amount')
      .not('seller_id', 'is', null)
      .limit(10);
    
    if (allOrdersError) {
      console.error('Error checking all orders:', allOrdersError.message);
    } else {
      console.log(`Found ${allOrders.length} orders with seller_id`);
      if (allOrders.length > 0) {
        const uniqueSellerIds = [...new Set(allOrders.map(o => o.seller_id))];
        console.log('Unique seller IDs in orders:', uniqueSellerIds);
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

debugCustomersData();