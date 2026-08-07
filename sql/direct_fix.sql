-- Direct fix for the create_profile_unified function
-- Run this directly in Supabase Dashboard SQL Editor

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.create_profile_unified(text, text, text);
DROP FUNCTION IF EXISTS public.create_profile_unified(text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_profile_unified(text, text);
DROP FUNCTION IF EXISTS public.create_profile_unified(text);

-- Create the corrected function
CREATE OR REPLACE FUNCTION public.create_profile_unified(
    phone_number text,
    user_role text DEFAULT 'retailer',
    language text DEFAULT 'en'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    user_id uuid;
    profile_id uuid;
    result json;
    existing_profile profiles%ROWTYPE;
    default_business_details json;
BEGIN
    -- Log function call
    RAISE NOTICE 'create_profile_unified called with phone: %, role: %, language: %', phone_number, user_role, language;
    
    -- Validate inputs
    IF phone_number IS NULL OR phone_number = '' THEN
        RAISE EXCEPTION 'Phone number cannot be null or empty';
    END IF;
    
    IF user_role NOT IN ('retailer', 'seller', 'admin') THEN
        RAISE EXCEPTION 'Invalid user role: %', user_role;
    END IF;
    
    -- Check if user already exists in auth.users
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE phone = phone_number;
    
    -- If user doesn't exist in auth.users, create one
    IF user_id IS NULL THEN
        user_id := gen_random_uuid();
        
        RAISE NOTICE 'Creating new auth.users entry with id: % and phone: %', user_id, phone_number;
        
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            phone,
            phone_confirmed_at,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin
        ) VALUES (
            user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            NULL,
            crypt('temp_password', gen_salt('bf')),
            NOW(),
            phone_number,
            NOW(),
            NOW(),
            NOW(),
            '{"provider": "phone", "providers": ["phone"]}'::jsonb,
            '{}'::jsonb,
            false
        );
        
        RAISE NOTICE 'Successfully created auth.users entry';
    ELSE
        RAISE NOTICE 'Found existing auth.users entry with id: %', user_id;
    END IF;
    
    -- Set default business details based on role
    IF user_role = 'seller' THEN
        default_business_details := '{"business_type": "seller", "verification_status": "pending"}';
    ELSE
        default_business_details := '{"business_type": "retailer", "verification_status": "pending"}';
    END IF;
    
    -- Check if profile already exists
    SELECT * INTO existing_profile 
    FROM profiles 
    WHERE id = user_id;
    
    IF existing_profile.id IS NOT NULL THEN
        -- Update existing profile
        RAISE NOTICE 'Updating existing profile for user_id: %', user_id;
        
        UPDATE profiles 
        SET 
            phone_number = create_profile_unified.phone_number,
            role = user_role,
            language = create_profile_unified.language,
            business_details = COALESCE(business_details, default_business_details),
            updated_at = now()
        WHERE id = user_id
        RETURNING id INTO profile_id;
        
        RAISE NOTICE 'Successfully updated profile with id: %', profile_id;
    ELSE
        -- Create new profile
        RAISE NOTICE 'Creating new profile for user_id: %', user_id;
        
        INSERT INTO profiles (
            id,
            phone_number,
            role,
            business_details,
            language,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            create_profile_unified.phone_number,
            user_role,
            default_business_details,
            create_profile_unified.language,
            now(),
            now()
        )
        RETURNING id INTO profile_id;
        
        RAISE NOTICE 'Successfully created profile with id: %', profile_id;
    END IF;
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'user_id', user_id,
        'profile_id', profile_id,
        'phone_number', phone_number,
        'role', user_role,
        'language', language,
        'message', 'Profile created/updated successfully'
    );
    
    RAISE NOTICE 'Function completed successfully: %', result;
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in create_profile_unified: % %', SQLSTATE, SQLERRM;
        result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'message', 'Failed to create/update profile'
        );
        RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_profile_unified(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_unified(text, text, text) TO anon;