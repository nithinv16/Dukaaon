-- Profile Creation Fix - Aligned with Current App Workflow
-- This fix ensures the create_profile_unified function works with the current app's OTP flow

-- Drop and recreate the function to ensure it matches the app's expectations
DROP FUNCTION IF EXISTS public.create_profile_unified(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.create_profile_unified(
    phone_number TEXT,
    user_role TEXT DEFAULT 'retailer',
    seller_data JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    profile_record JSONB;
    existing_profile RECORD;
    auth_user_id UUID;
    existing_auth_user RECORD;
BEGIN
    -- Log the function call for debugging
    RAISE NOTICE 'create_profile_unified called with phone: %, role: %', phone_number, user_role;

    -- Validate inputs
    IF phone_number IS NULL OR phone_number = '' THEN
        RAISE EXCEPTION 'Phone number cannot be null or empty';
    END IF;

    IF user_role IS NULL OR user_role = '' THEN
        user_role := 'retailer';
    END IF;

    -- Check if auth.users entry exists with this phone number
    SELECT * INTO existing_auth_user
    FROM auth.users
    WHERE phone = phone_number;
    
    IF existing_auth_user.id IS NULL THEN
        -- Create new auth.users entry
        auth_user_id := gen_random_uuid();
        
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
            auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            auth_user_id::text || '@placeholder.com',
            phone_number,
            jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']),
            jsonb_build_object('role', user_role),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created new auth.users entry with id: %', auth_user_id;
    ELSE
        auth_user_id := existing_auth_user.id;
        RAISE NOTICE 'Found existing auth.users entry with id: %', auth_user_id;
    END IF;

    -- Check if profile already exists
    SELECT * INTO existing_profile
    FROM public.profiles
    WHERE id = auth_user_id OR phone_number = phone_number;
    
    IF existing_profile.id IS NOT NULL THEN
        -- Update existing profile
        UPDATE public.profiles
        SET 
            role = user_role,
            updated_at = NOW()
        WHERE id = existing_profile.id
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        RAISE NOTICE 'Updated existing profile with id: %', existing_profile.id;
    ELSE
        -- Create new profile
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
                WHEN user_role IN ('seller', 'wholesaler') THEN 
                    COALESCE(seller_data, jsonb_build_object(
                        'shopName', 'My Business',
                        'address', 'Address pending'
                    ))
                WHEN user_role = 'retailer' THEN 
                    jsonb_build_object(
                        'shopName', 'My Shop',
                        'address', 'Address pending'
                    )
                ELSE '{}'
            END,
            NOW(),
            NOW()
        )
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        RAISE NOTICE 'Created new profile with id: %', auth_user_id;
    END IF;

    -- Return the profile data
    RETURN jsonb_build_object(
        'success', true,
        'profile', profile_record,
        'message', 'Profile created/updated successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in create_profile_unified: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_profile_unified TO authenticated, anon;

-- Test the function to ensure it works
DO $$
DECLARE
    test_result JSONB;
BEGIN
    -- Test with a sample phone number
    SELECT public.create_profile_unified('+919999999999', 'retailer') INTO test_result;
    RAISE NOTICE 'Test result: %', test_result;
    
    -- Clean up test data
    DELETE FROM public.profiles WHERE phone_number = '+919999999999';
    DELETE FROM auth.users WHERE phone = '+919999999999';
    
    RAISE NOTICE 'Function test completed successfully';
END;
$$;