-- Function to update location coordinates in profiles table
CREATE OR REPLACE FUNCTION public.update_user_location(
  p_user_id UUID,
  p_latitude FLOAT,
  p_longitude FLOAT
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Update the user profile with location coordinates
  UPDATE profiles
  SET 
    latitude = p_latitude,
    longitude = p_longitude,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id
  RETURNING jsonb_build_object('latitude', latitude, 'longitude', longitude) INTO result;
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', TRUE,
    'location', result
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM,
      'details', 'SQL error occurred while updating location'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 