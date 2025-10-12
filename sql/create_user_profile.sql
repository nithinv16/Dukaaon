-- Function to create or update a user profile linked to Firebase ID
-- This function runs with SECURITY DEFINER to bypass RLS policies
-- Parameters:
--   user_firebase_id: Firebase UID
--   user_phone: Phone number (without +91 prefix)
--   user_role: User role (retailer, seller, etc.)

CREATE OR REPLACE FUNCTION public.create_user_profile(
    user_firebase_id TEXT,
    user_phone TEXT,
    user_role TEXT DEFAULT 'retailer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_record JSONB;
    new_profile_id UUID;
    existing_id UUID;
BEGIN
    -- Log the function call for debugging
    RAISE NOTICE 'Creating/updating profile for Firebase ID: %, Phone: %, Role: %', 
                  user_firebase_id, user_phone, user_role;

    -- First check if a profile already exists with this Firebase ID
    SELECT id INTO existing_id
    FROM public.profiles
    WHERE fire_id = user_firebase_id;

    IF existing_id IS NOT NULL THEN
        -- Update existing profile
        RAISE NOTICE 'Updating existing profile with ID: %', existing_id;
        
        UPDATE public.profiles
        SET 
            phone_number = user_phone,
            role = user_role,
            updated_at = NOW()
        WHERE id = existing_id
        RETURNING to_jsonb(profiles.*) INTO profile_record;
    ELSE
        -- Check if profile exists with the phone number
        SELECT id INTO existing_id
        FROM public.profiles
        WHERE phone_number = user_phone;
        
        IF existing_id IS NOT NULL THEN
            -- Update existing profile by phone and add Firebase ID
            RAISE NOTICE 'Linking Firebase ID to existing profile with phone: %', user_phone;
            
            UPDATE public.profiles
            SET 
                fire_id = user_firebase_id,
                role = user_role,
                updated_at = NOW()
            WHERE id = existing_id
            RETURNING to_jsonb(profiles.*) INTO profile_record;
        ELSE
            -- Create new profile with Firebase ID and phone
            RAISE NOTICE 'Creating new profile';
            
            INSERT INTO public.profiles (
                fire_id,
                phone_number,
                role,
                status,
                created_at,
                updated_at,
                business_details
            )
            VALUES (
                user_firebase_id,
                user_phone,
                user_role,
                'active',
                NOW(),
                NOW(),
                jsonb_build_object(
                    'shopName', 'My Shop',
                    'address', 'Address pending',
                    'created_at', NOW()
                )
            )
            RETURNING to_jsonb(profiles.*) INTO profile_record;
        END IF;
    END IF;

    -- Return the profile as JSON
    RETURN profile_record;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in create_user_profile: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon; 