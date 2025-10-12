-- Simple updated policies with proper type casting

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow public insert of profiles" ON profiles;
DROP POLICY IF EXISTS "Allow service role to manage profiles" ON profiles;

-- Create policy to allow authenticated users to insert their own profiles
CREATE POLICY "Allow users to insert their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = fire_id OR
  -- Allow creation during OTP flow where fire_id might be null
  (fire_id IS NULL AND phone_number IS NOT NULL)
);

-- Create policy to allow authenticated users to view their own profiles
CREATE POLICY "Allow users to view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = fire_id OR
  -- Allow viewing during OTP flow where fire_id might be null
  (fire_id IS NULL AND phone_number IS NOT NULL)
);

-- Create policy to allow authenticated users to update their own profiles
CREATE POLICY "Allow users to update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = fire_id OR
  -- Allow updating during OTP flow where fire_id might be null
  (fire_id IS NULL AND phone_number IS NOT NULL)
);

-- Create policy to allow unauthenticated users to insert profiles
CREATE POLICY "Allow public insert of profiles"
ON profiles
FOR INSERT
TO anon
WITH CHECK (true);

-- Create policy to allow service roles to manage profiles
CREATE POLICY "Allow service role to manage profiles"
ON profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create a simple helper function to create profiles
CREATE OR REPLACE FUNCTION create_profile_if_not_exists(
  p_fire_id TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_language TEXT DEFAULT 'en',
  p_status TEXT DEFAULT 'pending'
)
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER -- Run with privileges of the function creator
SET search_path = public
AS $$
DECLARE
  v_profile profiles;
BEGIN
  -- First check if profile exists by phone number
  SELECT * INTO v_profile FROM profiles WHERE phone_number = p_phone LIMIT 1;
  
  -- If profile exists, return it
  IF v_profile.id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM profiles WHERE id = v_profile.id;
    RETURN;
  END IF;
  
  -- Otherwise, create a new profile
  RETURN QUERY 
  INSERT INTO profiles (
    fire_id,
    phone_number,
    role,
    language,
    status,
    created_at,
    updated_at,
    business_details
  )
  VALUES (
    p_fire_id,
    p_phone,
    p_role,
    p_language,
    p_status,
    NOW(),
    NOW(),
    jsonb_build_object(
      'shopName', 'My Shop',
      'address', 'Address pending',
      'created_at', NOW()
    )
  )
  RETURNING *;
  
  RETURN;
END;
$$;

-- Grant execute permission to all relevant roles
GRANT EXECUTE ON FUNCTION create_profile_if_not_exists TO authenticated, anon, service_role; 