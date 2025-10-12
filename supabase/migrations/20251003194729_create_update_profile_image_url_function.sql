-- Create function to update profile_image_url bypassing RLS
-- This function is needed for profile image upload functionality

CREATE OR REPLACE FUNCTION public.update_profile_image_url(
  p_user_id UUID,
  p_image_url TEXT
) RETURNS JSONB AS $$
DECLARE
  updated_profile_id UUID;
BEGIN
  -- Update the profile_image_url
  UPDATE public.profiles
  SET
    profile_image_url = p_image_url,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING id INTO updated_profile_id;
  
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
      'message', 'Profile image URL updated successfully'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_profile_image_url(UUID, TEXT) TO authenticated;

-- Add comment to document the function
COMMENT ON FUNCTION public.update_profile_image_url IS 'Updates profile_image_url for a user, bypassing RLS policies. Used for profile image upload functionality.';

-- Log the function creation
DO $$
BEGIN
    RAISE NOTICE 'Created update_profile_image_url function successfully';
END $$;