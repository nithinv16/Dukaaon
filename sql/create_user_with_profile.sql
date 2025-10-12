-- Function to create a user in auth.users and a profile in profiles in one transaction
-- This avoids foreign key constraint issues and ensures proper linkage

CREATE OR REPLACE FUNCTION public.create_user_with_profile(
    p_phone TEXT,
    p_firebase_id TEXT,
    p_role TEXT DEFAULT 'retailer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id UUID;
    normalized_phone TEXT;
    result_profile JSONB;
BEGIN
    -- Normalize phone number (remove +91 if present)
    IF p_phone LIKE '+91%' THEN
        normalized_phone := substring(p_phone from 4);
    ELSE
        normalized_phone := p_phone;
    END IF;
    
    -- First check if profile already exists with this phone or Firebase ID
    SELECT id INTO user_id FROM profiles
    WHERE phone_number = normalized_phone OR fire_id = p_firebase_id
    LIMIT 1;
    
    IF user_id IS NOT NULL THEN
        -- Profile exists, update it and return
        UPDATE profiles
        SET 
            fire_id = p_firebase_id,
            updated_at = NOW()
        WHERE id = user_id
        RETURNING to_jsonb(profiles.*) INTO result_profile;
        
        RETURN jsonb_build_object(
            'success', true,
            'profile', result_profile,
            'message', 'Updated existing profile'
        );
    END IF;
    
    -- Generate UUID for the new user
    user_id := gen_random_uuid();
    
    -- Create in a transaction to ensure both operations succeed or fail together
    BEGIN
        -- Create user in auth.users
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            phone
        )
        VALUES (
            user_id,
            '00000000-0000-0000-0000-000000000000'::uuid,
            'authenticated',
            'authenticated',
            user_id || '@temp.dukaaon.com',
            crypt(gen_random_uuid()::text, gen_salt('bf')), -- Random password
            NOW(),
            NOW(),
            NOW(),
            jsonb_build_object('provider', 'firebase', 'providers', ARRAY['firebase']),
            jsonb_build_object('phone', normalized_phone),
            NOW(),
            NOW(),
            normalized_phone
        );
        
        -- Create profile
        INSERT INTO profiles (
            id,
            fire_id,
            phone_number,
            role,
            status,
            created_at,
            updated_at,
            business_details
        )
        VALUES (
            user_id,
            p_firebase_id,
            normalized_phone,
            p_role,
            'active',
            NOW(),
            NOW(),
            jsonb_build_object('shopName', 'My Shop', 'createdAt', NOW())
        )
        RETURNING to_jsonb(profiles.*) INTO result_profile;
        
        -- Return successful result
        RETURN jsonb_build_object(
            'success', true,
            'profile', result_profile,
            'message', 'Created new user and profile'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Handle any errors during the process
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create user and profile'
        );
    END;
END;
$$;

-- Grant execute permissions to anyone who needs to create users
GRANT EXECUTE ON FUNCTION public.create_user_with_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_with_profile TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_with_profile TO service_role; 