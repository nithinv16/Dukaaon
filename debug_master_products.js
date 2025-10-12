const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://ybpjuvsqkqtjqzlqzqzq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicGp1dnNxa3F0anF6bHF6cXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1OTQ4NzQsImV4cCI6MjA1MDE3MDg3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMasterProducts() {
  try {
    console.log('=== DEBUGGING MASTER PRODUCTS TABLE ===\n');
    
    // 1. Check if table exists and get structure
    console.log('1. Checking table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('master_products')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Error accessing master_products table:', tableError.message);
      return;
    }
    
    console.log('✓ master_products table exists and is accessible');
    
    // 2. Get total count
    const { count, error: countError } = await supabase
      .from('master_products')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting records:', countError.message);
    } else {
      console.log(`✓ Total records in master_products: ${count}`);
    }
    
    // 3. Check for null values in id and min_qty
    console.log('\n2. Checking for null values in id and min_qty columns...');
    
    const { data: nullIds, error: nullIdError } = await supabase
      .from('master_products')
      .select('*')
      .is('id', null);
    
    if (nullIdError) {
      console.error('Error checking null ids:', nullIdError.message);
    } else {
      console.log(`Records with null id: ${nullIds.length}`);
      if (nullIds.length > 0) {
        console.log('Records with null id:', nullIds);
      }
    }
    
    const { data: nullMinQty, error: nullMinQtyError } = await supabase
      .from('master_products')
      .select('*')
      .is('min_qty', null);
    
    if (nullMinQtyError) {
      console.error('Error checking null min_qty:', nullMinQtyError.message);
    } else {
      console.log(`Records with null min_qty: ${nullMinQty.length}`);
      if (nullMinQty.length > 0) {
        console.log('Records with null min_qty:', nullMinQty);
      }
    }
    
    // 4. Sample data inspection
    console.log('\n3. Sample data from master_products:');
    const { data: sampleData, error: sampleError } = await supabase
      .from('master_products')
      .select('id, name, brand, category, min_qty')
      .limit(5);
    
    if (sampleError) {
      console.error('Error fetching sample data:', sampleError.message);
    } else {
      console.log('Sample records:');
      sampleData.forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id} (type: ${typeof record.id}), Name: ${record.name}, Min Qty: ${record.min_qty} (type: ${typeof record.min_qty})`);
      });
    }
    
    // 5. Check data types by examining actual values
    console.log('\n4. Data type analysis:');
    if (sampleData && sampleData.length > 0) {
      const firstRecord = sampleData[0];
      console.log('First record analysis:');
      console.log(`- id: ${firstRecord.id} (${typeof firstRecord.id})`);
      console.log(`- min_qty: ${firstRecord.min_qty} (${typeof firstRecord.min_qty})`);
      
      // Test toString() calls
      try {
        const idString = firstRecord.id ? firstRecord.id.toString() : 'null';
        console.log(`- id.toString(): ${idString}`);
      } catch (error) {
        console.error(`- Error calling id.toString():`, error.message);
      }
      
      try {
        const minQtyString = firstRecord.min_qty ? firstRecord.min_qty.toString() : 'null';
        console.log(`- min_qty.toString(): ${minQtyString}`);
      } catch (error) {
        console.error(`- Error calling min_qty.toString():`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

debugMasterProducts();