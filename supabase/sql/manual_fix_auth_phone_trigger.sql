-- Run this script directly in the Supabase Dashboard SQL editor
-- This fixes the 'record new has no field phone' error

-- Drop the existing create_profile_unified function if it exists
DROP FUNCTION IF EXISTS public.create_profile_unified;

-- Create the updated create_profile_unified function
CREATE OR REPLACE FUNCTION public.create_profile_unified(
    phone_number TEXT,
    user_role TEXT DEFAULT 'retailer',
    seller_data JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
        -- Generate a new UUID
        auth_user_id := gen_random_uuid();
        
        -- Create a new auth.users record with ALL required fields explicitly
        -- This avoids any issues with triggers that might be expecting specific fields
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
        )
        VALUES (
            auth_user_id,
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
            phone_number = phone_number,
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
                ELSE '{}'::jsonb
            END,
            NOW(),
            NOW()
        )
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        profile_id := auth_user_id;
    END IF;
    
    -- Handle seller data if provided and user is a seller
    IF user_role IN ('seller', 'wholesaler') AND seller_data IS NOT NULL AND seller_data <> '{}'::jsonb THEN
        -- Check if seller details exist
        DECLARE
            seller_details_id UUID;
        BEGIN
            SELECT id INTO seller_details_id
            FROM public.seller_details
            WHERE user_id = auth_user_id
            LIMIT 1;
            
            IF seller_details_id IS NOT NULL THEN
                -- Update existing seller details
                UPDATE public.seller_details
                SET 
                    business_name = COALESCE(seller_data->>'business_name', business_name),
                    owner_name = COALESCE(seller_data->>'owner_name', owner_name),
                    seller_type = COALESCE(seller_data->>'seller_type', seller_type),
                    registration_number = COALESCE(seller_data->>'registration_number', registration_number),
                    gst_number = COALESCE(seller_data->>'gst_number', gst_number),
                    address = COALESCE(seller_data->>'address', address),
                    updated_at = NOW()
                WHERE id = seller_details_id;
            ELSE
                -- Create new seller details
                INSERT INTO public.seller_details (
                    user_id,
                    business_name,
                    owner_name,
                    seller_type,
                    registration_number,
                    gst_number,
                    address,
                    created_at,
                    updated_at
                )
                VALUES (
                    auth_user_id,
                    seller_data->>'business_name',
                    seller_data->>'owner_name',
                    seller_data->>'seller_type',
                    seller_data->>'registration_number',
                    seller_data->>'gst_number',
                    seller_data->>'address',
                    NOW(),
                    NOW()
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the entire function
            RAISE NOTICE 'Error handling seller data: %', SQLERRM;
        END;
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
            'success', false,
            'error', 'Profile already exists with this phone number',
            'existing_profile', profile_record
        );
    WHEN OTHERS THEN
        -- Handle any other errors
        RAISE NOTICE 'Error in create_profile_unified: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create or update profile'
        );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_profile_unified TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_unified TO anon;
GRANT EXECUTE ON FUNCTION public.create_profile_unified TO service_role;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.create_profile_unified IS 'Robust fix for "record new has no field phone" error. Explicitly lists all required fields when inserting into auth.users and handles schema paths correctly.';

-- Verify the function was created successfully
SELECT 'Function created successfully' AS message;