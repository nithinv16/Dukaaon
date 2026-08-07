-- Fix create_profile_unified function return structure
-- The app expects result.profile but the function returns result.profile_id
-- This causes the app to think profile creation failed even when it succeeds

-- Drop existing function
DROP FUNCTION IF EXISTS public.create_profile_unified(text, text, text);
DROP FUNCTION IF EXISTS public.create_profile_unified(text, text);

-- Create the corrected function with proper return structure
CREATE OR REPLACE FUNCTION public.create_profile_unified(
    phone_number text,
    user_role text DEFAULT 'retailer'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    user_id uuid;
    profile_record profiles%ROWTYPE;
    result json;
    existing_profile profiles%ROWTYPE;
    default_business_details jsonb;
BEGIN
    -- Log function call
    RAISE NOTICE 'create_profile_unified called with phone: %, role: %', phone_number, user_role;
    
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
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            last_sign_in_at,
            invited_at,
            confirmation_sent_at,
            recovery_sent_at,
            email_change_sent_at,
            email_change_confirm_status,
            banned_until,
            deleted_at,
            is_sso_user
        ) VALUES (
            user_id,
            '00000000-0000-0000-0000-000000000000'::uuid,
            'authenticated',
            'authenticated',
            user_id::text || '@temp.dukaaon.com',
            '$2a$10$XkbLZl6.XJCOqj7Y5hULGehUPRqHREZiAIDPjZD3uQUfR1J2tA5f6',
            now(),
            phone_number,
            now(),
            '',
            '',
            '',
            '',
            now(),
            now(),
            '{}',
            '{}',
            false,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            0,
            NULL,
            NULL,
            false
        );
        
        RAISE NOTICE 'Successfully created auth.users entry';
    ELSE
        RAISE NOTICE 'Found existing auth.users entry with id: %', user_id;
    END IF;
    
    -- Set default business details based on role
    IF user_role = 'seller' THEN
        default_business_details := '{"business_type": "seller", "verification_status": "pending"}'::jsonb;
    ELSE
        default_business_details := '{"business_type": "retailer", "verification_status": "pending"}'::jsonb;
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
            business_details = COALESCE(business_details, default_business_details),
            updated_at = now()
        WHERE id = user_id
        RETURNING * INTO profile_record;
        
        RAISE NOTICE 'Successfully updated profile with id: %', profile_record.id;
    ELSE
        -- Create new profile
        RAISE NOTICE 'Creating new profile for user_id: %', user_id;
        
        INSERT INTO profiles (
            id,
            phone_number,
            role,
            business_details,
            status,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            create_profile_unified.phone_number,
            user_role,
            default_business_details,
            'active',
            now(),
            now()
        )
        RETURNING * INTO profile_record;
        
        RAISE NOTICE 'Successfully created profile with id: %', profile_record.id;
    END IF;
    
    -- Return success result with PROFILE data (not just profile_id)
    -- This is the key fix - the app expects result.profile, not result.profile_id
    result := json_build_object(
        'success', true,
        'profile', row_to_json(profile_record),  -- Return full profile object
        'user_id', user_id,
        'profile_id', profile_record.id,
        'phone_number', phone_number,
        'role', user_role,
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
GRANT EXECUTE ON FUNCTION public.create_profile_unified(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_unified(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_profile_unified(text, text) TO service_role;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.create_profile_unified IS 'Fixed function that returns result.profile (full profile object) instead of result.profile_id to match app expectations';