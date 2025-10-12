const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUserSettingsTable() {
  try {
    console.log('Creating user_settings table...');
    
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20250115120000_create_user_settings_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error creating table:', error);
      
      // Try alternative approach - execute SQL directly
      console.log('Trying alternative approach...');
      const { data: altData, error: altError } = await supabase
        .from('user_settings')
        .select('*')
        .limit(1);
      
      if (altError && altError.code === '42P01') {
        console.log('Table does not exist. Creating manually...');
        
        // Create table with basic structure
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS public.user_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            notifications_enabled BOOLEAN DEFAULT TRUE,
            order_updates_enabled BOOLEAN DEFAULT TRUE,
            promotions_enabled BOOLEAN DEFAULT FALSE,
            dark_mode BOOLEAN DEFAULT FALSE,
            language VARCHAR(10) DEFAULT 'en',
            email_notifications BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;
        
        console.log('Table created successfully!');
        return;
      }
    }
    
    console.log('Migration executed successfully!');
    console.log('user_settings table is now available.');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Test if table exists
async function testTable() {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ user_settings table does not exist');
        return false;
      } else {
        console.log('❌ Error accessing table:', error.message);
        return false;
      }
    }
    
    console.log('✅ user_settings table exists and is accessible');
    return true;
  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
    return false;
  }
}

async function main() {
  console.log('Checking user_settings table...');
  
  const tableExists = await testTable();
  
  if (!tableExists) {
    await createUserSettingsTable();
    
    // Test again
    console.log('\nTesting table after creation...');
    await testTable();
  }
}

main().catch(console.error);