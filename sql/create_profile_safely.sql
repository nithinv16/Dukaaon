-- Function to safely create a user profile with better error handling
-- This function handles creating a profile linked to a Firebase ID
-- It will:
--  1. Check if a profile with this Firebase ID already exists
--  2. Check if a profile with this phone number exists
--  3. Create a new user entry in auth.users if needed
--  4. Create a new profile if needed
--  5. Return detailed success/error information

CREATE OR REPLACE FUNCTION public.create_profile_safely(
    p_firebase_id TEXT,
    p_phone_number TEXT,
    p_role TEXT DEFAULT 'retailer',
    p_status TEXT DEFAULT 'active'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_record JSONB;
    existing_id UUID;
    normalized_phone TEXT;
    new_id UUID;
    user_exists BOOLEAN;
BEGIN
    -- Log the function call for debugging
    RAISE NOTICE 'Creating profile safely - Firebase ID: %, Phone: %, Role: %', 
                 p_firebase_id, p_phone_number, p_role;
                 
    -- Normalize phone number by removing +91 prefix if it exists
    IF p_phone_number LIKE '+91%' THEN
        normalized_phone := substring(p_phone_number from 4);
    ELSE
        normalized_phone := p_phone_number;
    END IF;
    
    RAISE NOTICE 'Normalized phone: %', normalized_phone;

    -- First check if a profile already exists with this Firebase ID
    SELECT id INTO existing_id
    FROM public.profiles
    WHERE fire_id = p_firebase_id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
        -- Update existing profile
        RAISE NOTICE 'Profile with Firebase ID already exists, updating: %', existing_id;
        
        UPDATE public.profiles
        SET 
            phone_number = normalized_phone,
            updated_at = NOW()
        WHERE id = existing_id
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        RETURN jsonb_build_object(
            'success', true,
            'profile', profile_record,
            'message', 'Updated existing profile with Firebase ID'
        );
    END IF;
    
    -- Check if profile exists with the phone number
    SELECT id INTO existing_id
    FROM public.profiles
    WHERE phone_number = normalized_phone
    LIMIT 1;
    
    IF existing_id IS NOT NULL THEN
        -- Update existing profile by phone and add Firebase ID
        RAISE NOTICE 'Profile with phone number exists, linking Firebase ID: %', existing_id;
        
        UPDATE public.profiles
        SET 
            fire_id = p_firebase_id,
            role = p_role,
            updated_at = NOW()
        WHERE id = existing_id
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        RETURN jsonb_build_object(
            'success', true,
            'profile', profile_record,
            'message', 'Linked Firebase ID to existing profile with phone number'
        );
    END IF;
    
    -- Create new profile with Firebase ID and phone
    RAISE NOTICE 'No existing profile found, creating new one';
    
    -- Generate a UUID for the new profile
    new_id := gen_random_uuid();
    
    -- Check if a user exists with this ID in auth.users
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE id = new_id
    ) INTO user_exists;
    
    -- If user doesn't exist, we need to create one first
    IF NOT user_exists THEN
        RAISE NOTICE 'Creating new user in auth.users with ID: %', new_id;
        
        BEGIN
            -- First, create a user in auth.users table
            INSERT INTO auth.users (
                id,
                instance_id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                created_at,
                updated_at,
                phone
            )
            VALUES (
                new_id,
                '00000000-0000-0000-0000-000000000000'::uuid,
                'authenticated',
                'authenticated',
                new_id || '@temp.dukaaon.com',
                '$2a$10$XkbLZl6.XJCOqj7Y5hULGehUPRqHREZiAIDPjZD3uQUfR1J2tA5f6', -- Dummy password
                NOW(),
                NOW(),
                NOW(),
                normalized_phone
            );
            
            RAISE NOTICE 'Successfully created user in auth.users';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error creating user in auth.users: %', SQLERRM;
            
            -- Try a different approach - check if any existing user ID is available
            DECLARE
                available_id UUID;
            BEGIN
                -- Look for an auth.users ID that doesn't have a profile yet
                SELECT id INTO available_id 
                FROM auth.users au
                WHERE NOT EXISTS (
                    SELECT 1 FROM profiles p WHERE p.id = au.id
                )
                LIMIT 1;
                
                IF available_id IS NOT NULL THEN
                    RAISE NOTICE 'Found available user ID: %', available_id;
                    new_id := available_id;
                ELSE
                    -- Failed to create user or find available ID
                    RETURN jsonb_build_object(
                        'success', false,
                        'error', SQLERRM,
                        'message', 'Failed to create auth user entry'
                    );
                END IF;
            END;
        END;
    END IF;
    
    BEGIN
        -- Now create the profile using the ID
        INSERT INTO public.profiles (
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
            new_id,
            p_firebase_id,
            normalized_phone,
            p_role,
            p_status,
            NOW(),
            NOW(),
            jsonb_build_object(
                'createdAt', NOW(),
                'shopName', 'My Shop'
            )
        )
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        RETURN jsonb_build_object(
            'success', true,
            'profile', profile_record,
            'message', 'Created new profile successfully'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Handle insert errors
        RAISE NOTICE 'Error creating profile: %', SQLERRM;
        
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create profile'
        );
    END;

EXCEPTION WHEN OTHERS THEN
    -- Handle any other errors
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'message', 'Unexpected error during profile creation'
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_profile_safely TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_safely TO anon;
GRANT EXECUTE ON FUNCTION public.create_profile_safely TO service_role; 