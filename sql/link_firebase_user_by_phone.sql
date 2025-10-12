-- Function to link a Firebase UID to an existing profile by phone number
-- Returns the updated profile if successful, or error information
-- This function runs with SECURITY DEFINER to bypass RLS policies

CREATE OR REPLACE FUNCTION public.link_firebase_user_by_phone(
    phone_number TEXT,
    firebase_id TEXT,
    auth_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_profile_id UUID;
    existing_user_id UUID;
    result_record JSONB;
BEGIN
    -- Log the function call for debugging
    RAISE NOTICE 'Linking Firebase ID: % to profile with phone: %, auth_id: %', 
                 firebase_id, phone_number, auth_id;
    
    -- First check if there's already a profile with this Firebase ID
    SELECT id INTO existing_user_id
    FROM public.profiles
    WHERE fire_id = firebase_id;
    
    IF existing_user_id IS NOT NULL THEN
        -- A profile with this Firebase ID already exists
        RAISE NOTICE 'Profile with Firebase ID already exists: %', existing_user_id;
        
        SELECT to_jsonb(profiles.*) INTO result_record
        FROM public.profiles
        WHERE id = existing_user_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'profile', result_record,
            'message', 'Profile with this Firebase ID already exists'
        );
    END IF;
    
    -- Check if auth_id was provided and if a profile with this ID exists
    IF auth_id IS NOT NULL THEN
        SELECT id INTO target_profile_id
        FROM public.profiles
        WHERE id = auth_id;
        
        IF target_profile_id IS NOT NULL THEN
            -- Update the profile with the Firebase ID
            RAISE NOTICE 'Profile with auth_id exists, updating with fire_id: %', firebase_id;
            
            UPDATE public.profiles
            SET 
                fire_id = firebase_id,
                updated_at = NOW()
            WHERE id = auth_id
            RETURNING to_jsonb(profiles.*) INTO result_record;
            
            -- Return success with the updated profile
            RETURN jsonb_build_object(
                'success', true,
                'profile', result_record,
                'message', 'Firebase ID linked to existing profile by auth ID'
            );
        ELSE
            -- No profile with this auth_id, try to create one with this ID
            RAISE NOTICE 'No profile with auth_id, creating new profile with ID: %', auth_id;
            
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
                auth_id,
                firebase_id,
                phone_number,
                'retailer',
                'active',
                NOW(),
                NOW(),
                jsonb_build_object(
                    'shopName', 'My Shop',
                    'address', 'Address pending',
                    'created_at', NOW()
                )
            )
            RETURNING to_jsonb(profiles.*) INTO result_record;
            
            -- Return success with the created profile
            RETURN jsonb_build_object(
                'success', true,
                'profile', result_record,
                'message', 'New profile created with auth ID and Firebase ID'
            );
        END IF;
    END IF;
    
    -- If we get here, try to find profile by phone number
    SELECT id INTO target_profile_id
    FROM public.profiles
    WHERE phone_number = phone_number;
    
    IF target_profile_id IS NULL THEN
        -- No profile found with this phone number
        RAISE NOTICE 'No profile found with phone number: %', phone_number;
        
        -- Check if we have auth_id but failed above
        IF auth_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'Failed to create or update profile with auth ID'
            );
        END IF;
        
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No profile found with this phone number'
        );
    END IF;
    
    -- Update the profile with the Firebase ID
    UPDATE public.profiles
    SET 
        fire_id = firebase_id,
        updated_at = NOW()
    WHERE id = target_profile_id
    RETURNING to_jsonb(profiles.*) INTO result_record;
    
    -- Return success with the updated profile
    RETURN jsonb_build_object(
        'success', true,
        'profile', result_record,
        'message', 'Firebase ID linked to existing profile by phone'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error linking Firebase ID: ' || SQLERRM
        );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.link_firebase_user_by_phone TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_firebase_user_by_phone TO anon; 