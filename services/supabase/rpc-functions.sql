-- 
-- RPC Functions for User Profile Management in Supabase 
-- 
-- This file contains functions that handle creating, linking, and managing user profiles
-- while respecting the relationship between auth.users and profiles tables.
--

--
-- Creates a user profile including both auth.users and profiles tables
--
CREATE OR REPLACE FUNCTION create_user_profile_direct(
  phone_number text,
  user_id_param text, 
  user_role text,
  jwt_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_id uuid;
  new_profile jsonb;
BEGIN
  -- Check if user already exists in auth.users by phone
  SELECT id INTO user_id FROM auth.users
  WHERE phone = phone_number;
  
  IF user_id IS NULL THEN
    -- Create new auth user first with a generated UUID
    user_id := gen_random_uuid();
    
    BEGIN
      INSERT INTO auth.users (
        id,
        instance_id,
        role,
        aud,
        email,
        phone,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      ) VALUES (
        user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        user_id_param || '@placeholder.com', -- Placeholder email using user ID
        phone_number,
        jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']),
        jsonb_build_object('user_id', user_id_param, 'role', user_role),
        NOW(),
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'message', 'Error creating auth user: ' || SQLERRM
      );
    END;
    
    -- Then create matching profile record with the same ID
    BEGIN
      INSERT INTO public.profiles (
        id,
        user_id,
        phone_number,
        role,
        status,
        created_at,
        updated_at
      ) VALUES (
        user_id, -- Use same ID as auth.users
        user_id_param,
        phone_number,
        user_role,
        'pending',
        NOW(),
        NOW()
      )
      RETURNING to_jsonb(profiles.*) INTO new_profile;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'message', 'Error creating profile record: ' || SQLERRM
      );
    END;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', new_profile,
      'message', 'New user profile created successfully'
    );
  ELSE
    -- User exists in auth.users, check if profile exists
    SELECT to_jsonb(profiles.*) INTO new_profile 
    FROM public.profiles WHERE id = user_id;
    
    IF new_profile IS NULL THEN
      -- Create profile for existing auth user
      BEGIN
        INSERT INTO public.profiles (
          id,
          user_id,
          phone_number,
          role,
          status,
          created_at,
          updated_at
        ) VALUES (
          user_id,
          user_id_param,
          phone_number,
          user_role,
          'pending',
          NOW(),
          NOW()
        )
        RETURNING to_jsonb(profiles.*) INTO new_profile;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', SQLERRM,
          'message', 'Error creating profile for existing auth user: ' || SQLERRM
        );
      END;
      
      RETURN jsonb_build_object(
        'success', true,
        'profile', new_profile,
        'message', 'Profile created for existing auth user'
      );
    ELSE
      -- Update existing profile
      BEGIN
        UPDATE public.profiles
        SET
          user_id = user_id_param,
          role = user_role,
          updated_at = NOW()
        WHERE id = user_id
        RETURNING to_jsonb(profiles.*) INTO new_profile;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', SQLERRM,
          'message', 'Error updating existing profile: ' || SQLERRM
        );
      END;
      
      RETURN jsonb_build_object(
        'success', true,
        'profile', new_profile,
        'message', 'Existing profile updated'
      );
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Error in profile creation: ' || SQLERRM
  );
END;
$$;

--
-- Creates a retailer profile using the user_profile_direct function
--
CREATE OR REPLACE FUNCTION create_retailer_profile(
  user_id_param text,
  phone_number text,
  jwt_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.create_user_profile_direct(
    phone_number,
    user_id_param,
    'retailer',
    jwt_token
  );
END;
$$;

--
-- Creates a seller profile using the user_profile_direct function
--
CREATE OR REPLACE FUNCTION create_seller_profile(
  user_id_param text,
  phone_number text,
  jwt_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.create_user_profile_direct(
    phone_number,
    user_id_param,
    'seller',
    jwt_token
  );
END;
$$;

--
-- Fallback function to create profiles without foreign key constraints
-- Only use as last resort if auth sync fails
--
CREATE OR REPLACE FUNCTION create_profile_no_constraint(
  user_id_param text,
  phone_number text,
  user_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_id uuid := gen_random_uuid();
  new_profile jsonb;
BEGIN
  -- Skip foreign key constraint checks temporarily if possible
  BEGIN
    -- First attempt to insert directly with a new UUID
    INSERT INTO public.profiles (
      id,
      user_id,
      phone_number,
      role,
      status,
      created_at,
      updated_at
    ) VALUES (
      profile_id,
      user_id_param,
      phone_number,
      user_role,
      'pending',
      NOW(),
      NOW()
    )
    RETURNING to_jsonb(profiles.*) INTO new_profile;
    
    -- Also try to create the auth.users record for consistency
    -- but don't fail if it doesn't work
    BEGIN
      INSERT INTO auth.users (
        id,
        instance_id,
        role,
        aud,
        email,
        phone,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      ) VALUES (
        profile_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        user_id_param || '@placeholder.com',
        phone_number,
        jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']),
        jsonb_build_object('user_id', user_id_param, 'role', user_role),
        NOW(),
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue since we've already created the profile
      RAISE NOTICE 'Error creating auth user in constraint-bypass mode: %', SQLERRM;
    END;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', new_profile,
      'message', 'Profile created with constraint bypass'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error in constraint bypass profile creation: ' || SQLERRM
    );
  END;
END;
$$;

--
-- Diagnostic function to identify why profile creation is failing
--
CREATE OR REPLACE FUNCTION diagnose_profile_creation(
  user_id_param text,
  phone_number text,
  user_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  auth_users_check boolean;
  profiles_check boolean;
  constraint_info jsonb;
BEGIN
  -- Check if we can query auth.users
  BEGIN
    SELECT EXISTS (SELECT 1 FROM auth.users LIMIT 1) INTO auth_users_check;
  EXCEPTION WHEN OTHERS THEN
    auth_users_check := false;
    result := jsonb_build_object('auth_users_access_error', SQLERRM);
  END;
  
  -- Check if we can query profiles
  BEGIN
    SELECT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) INTO profiles_check;
  EXCEPTION WHEN OTHERS THEN
    profiles_check := false;
    result := jsonb_build_object('profiles_access_error', SQLERRM);
  END;
  
  -- Get constraint info
  BEGIN
    SELECT jsonb_agg(
      jsonb_build_object(
        'constraint_name', constraint_name,
        'constraint_type', constraint_type,
        'table_name', table_name,
        'referenced_table_name', referenced_table_name
      )
    )
    FROM (
      SELECT 
        tc.constraint_name, 
        tc.constraint_type,
        tc.table_name,
        ccu.table_name as referenced_table_name
      FROM 
        information_schema.table_constraints tc
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'profiles'
    ) as constraints
    INTO constraint_info;
  EXCEPTION WHEN OTHERS THEN
    constraint_info := jsonb_build_object('constraint_info_error', SQLERRM);
  END;
  
  -- Check for existing user by phone
  DECLARE
    existing_auth_user jsonb;
    existing_profile jsonb;
  BEGIN
    SELECT to_jsonb(users.*) INTO existing_auth_user
    FROM auth.users users
    WHERE users.phone = phone_number;
    
    SELECT to_jsonb(profiles.*) INTO existing_profile
    FROM public.profiles profiles
    WHERE profiles.phone_number = phone_number;
    
    result := result || jsonb_build_object(
      'existing_auth_user', existing_auth_user,
      'existing_profile', existing_profile
    );
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('user_check_error', SQLERRM);
  END;
  
  -- Try minimal insertion test
  DECLARE
    test_uuid uuid := gen_random_uuid();
    test_result jsonb;
  BEGIN
    -- Try to insert into auth.users
    BEGIN
      WITH ins AS (
        INSERT INTO auth.users (
          id, email, phone, raw_user_meta_data
        ) VALUES (
          test_uuid,
          'test_' || user_id_param || '@diagnostic.test',
          'test_' || phone_number,
          jsonb_build_object('test', true, 'user_id', user_id_param)
        )
        RETURNING id
      ) SELECT true INTO auth_users_check;
      
      test_result := jsonb_build_object('auth_users_insert_test', 'success');
      
      -- Clean up test data
      DELETE FROM auth.users WHERE email = 'test_' || user_id_param || '@diagnostic.test';
    EXCEPTION WHEN OTHERS THEN
      test_result := jsonb_build_object(
        'auth_users_insert_test', 'error',
        'auth_users_insert_error', SQLERRM
      );
    END;
    
    result := result || test_result;
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('test_error', SQLERRM);
  END;
  
  -- Return all diagnostic information
  RETURN result || jsonb_build_object(
    'auth_users_accessible', auth_users_check,
    'profiles_accessible', profiles_check,
    'constraints', constraint_info,
    'test_timestamp', now()
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'diagnostic_error', SQLERRM,
    'message', 'Error running diagnostics'
  );
END;
$$;