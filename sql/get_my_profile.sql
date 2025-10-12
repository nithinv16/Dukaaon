-- Function to get the current user's profile data
-- This function runs with SECURITY DEFINER to bypass RLS policies
-- Returns the complete profile data for the authenticated user

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_record JSONB;
    current_user_id UUID;
BEGIN
    -- Get the current user's ID from auth.uid()
    current_user_id := auth.uid();
    
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not authenticated'
        );
    END IF;

    -- Fetch the user's profile data
    SELECT to_jsonb(profiles.*) INTO profile_record
    FROM public.profiles
    WHERE id = current_user_id;

    -- Check if profile exists
    IF profile_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Profile not found'
        );
    END IF;

    -- Return the profile data
    RETURN profile_record;

EXCEPTION WHEN OTHERS THEN
    -- Handle any errors
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;