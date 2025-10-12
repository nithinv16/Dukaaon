const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateDatabaseFunction() {
  try {
    console.log('Updating create_profile_unified function...');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync('fix-database-schema.sql', 'utf8');
    
    // Execute the SQL to update the function
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    });
    
    if (error) {
      console.error('Error updating function:', error);
      
      // Try alternative approach - just update the function
      const functionSql = `
CREATE OR REPLACE FUNCTION public.create_profile_unified(
    phone_number TEXT,
    user_role TEXT DEFAULT 'retailer',
    seller_data JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    auth_user_id UUID;
    profile_record JSONB;
    profile_id UUID;
    existing_id UUID;
BEGIN
    -- First, check if auth.users entry exists for this phone number
    SELECT id INTO auth_user_id
    FROM auth.users
    WHERE phone = phone_number
    LIMIT 1;
    
    -- If no auth.users entry exists, create one
    IF auth_user_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            phone,
            phone_confirmed_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            NULL,
            crypt('temp_password', gen_salt('bf')),
            NOW(),
            phone_number,
            NOW(),
            '',
            '',
            '',
            '',
            NOW(),
            NOW(),
            '{"provider": "phone", "providers": ["phone"]}',
            '{}',
            false
        )
        RETURNING id INTO auth_user_id;
    END IF;
    
    -- Check if profile already exists
    SELECT id INTO existing_id
    FROM public.profiles
    WHERE id = auth_user_id
    LIMIT 1;
    
    IF existing_id IS NOT NULL THEN
        -- Update existing profile
        UPDATE public.profiles
        SET 
            role = user_role,
            updated_at = NOW()
        WHERE id = existing_id
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        profile_id := existing_id;
    ELSE
        -- Create new profile with auth.users id
        INSERT INTO public.profiles (
            id,
            phone_number,
            role,
            status,
            business_details,
            created_at,
            updated_at
        )
        VALUES (
            auth_user_id,
            phone_number,
            user_role,
            'active',
            CASE 
                WHEN user_role = 'retailer' THEN jsonb_build_object(
                    'shopName', 'My Shop',
                    'address', 'Address pending'
                )
                ELSE '{}'
            END,
            NOW(),
            NOW()
        )
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        profile_id := auth_user_id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'profile_id', profile_id,
        'profile', profile_record
    );
    
EXCEPTION
    WHEN unique_violation THEN
        -- Handle duplicate key error
        SELECT to_jsonb(profiles.*) INTO profile_record
        FROM public.profiles
        WHERE phone_number = phone_number
        LIMIT 1;
        
        RETURN jsonb_build_object(
            'success', true,
            'profile_id', (profile_record->>'id')::UUID,
            'profile', profile_record,
            'message', 'Profile already exists'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
END;
$$;`;
      
      const { data: funcData, error: funcError } = await supabase.rpc('exec_sql', {
        sql: functionSql
      });
      
      if (funcError) {
        console.error('Error creating function directly:', funcError);
        return;
      }
    }
    
    console.log('✅ Database function updated successfully!');
    
    // Test the updated function
    console.log('\nTesting updated function...');
    const { data: testData, error: testError } = await supabase.rpc('create_profile_unified', {
      phone_number: '+919876543210',
      user_role: 'seller'
    });
    
    if (testError) {
      console.error('❌ Test failed:', testError);
    } else {
      console.log('✅ Test successful:', testData);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

updateDatabaseFunction();