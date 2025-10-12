-- Update the update_profile_image_url function with better logging and error handling
-- This will help debug why the profile_image_url column is not being updated

CREATE OR REPLACE FUNCTION public.update_profile_image_url(
  p_user_id UUID,
  p_image_url TEXT
) RETURNS JSONB AS $$
DECLARE
  updated_profile_id UUID;
  profile_exists BOOLEAN;
  current_url TEXT;
BEGIN
  -- Log the input parameters
  RAISE NOTICE 'update_profile_image_url called with user_id: %, image_url: %', p_user_id, p_image_url;
  
  -- Check if profile exists first
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) INTO profile_exists;
  
  IF NOT profile_exists THEN
    RAISE NOTICE 'Profile not found for user_id: %', p_user_id;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Profile not found for user ID: ' || p_user_id::text
    );
  END IF;
  
  -- Get current profile_image_url for logging
  SELECT profile_image_url INTO current_url FROM public.profiles WHERE id = p_user_id;
  RAISE NOTICE 'Current profile_image_url: %, New URL: %', current_url, p_image_url;
  
  -- Update the profile_image_url
  UPDATE public.profiles
  SET
    profile_image_url = p_image_url,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING id INTO updated_profile_id;
  
  -- Log the update result
  RAISE NOTICE 'Update completed. Updated profile ID: %', updated_profile_id;
  
  -- Return the result
  IF updated_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Profile not found or not updated'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'id', updated_profile_id,
      'message', 'Profile image URL updated successfully',
      'previous_url', current_url,
      'new_url', p_image_url
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in update_profile_image_url: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_profile_image_url(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_profile_image_url IS 'Updates profile_image_url for a user, bypassing RLS policies. Enhanced with logging for debugging.';