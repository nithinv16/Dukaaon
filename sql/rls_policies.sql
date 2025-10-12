-- RLS Policies for Firebase Authentication Integration

-- First, enable RLS on the profiles table if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous users to create profiles
CREATE POLICY "Allow anonymous insertions for new users" 
ON public.profiles 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Create policy to allow any authenticated user to select their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT
USING (
  -- Allow access if authenticated via Supabase Auth
  (auth.uid() = id) OR
  -- Allow access if authenticated via Firebase (fire_id matches)
  (fire_id = (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text)
);

-- Create policy to allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE
USING (
  -- Allow access if authenticated via Supabase Auth
  (auth.uid() = id) OR
  -- Allow access if authenticated via Firebase (fire_id matches)
  (fire_id = (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text)
)
WITH CHECK (
  -- Allow access if authenticated via Supabase Auth
  (auth.uid() = id) OR
  -- Allow access if authenticated via Firebase (fire_id matches)
  (fire_id = (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text)
);

-- RLS for retailer_details table
ALTER TABLE public.retailer_details ENABLE ROW LEVEL SECURITY;

-- Create policy for retailer_details selection
CREATE POLICY "Users can view their own retailer details" 
ON public.retailer_details 
FOR SELECT
USING (
  -- Find profile ID via Supabase Auth
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = retailer_details.user_id
    AND (
      -- Either Supabase auth
      profiles.id = auth.uid() OR
      -- Or Firebase auth
      profiles.fire_id = (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text
    )
  )
);

-- Create policy for retailer_details insertion
CREATE POLICY "Users can insert their own retailer details" 
ON public.retailer_details 
FOR INSERT
WITH CHECK (
  -- Find profile ID via Supabase Auth
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = retailer_details.user_id
    AND (
      -- Either Supabase auth
      profiles.id = auth.uid() OR
      -- Or Firebase auth
      profiles.fire_id = (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text
    )
  )
);

-- Create policy for retailer_details update
CREATE POLICY "Users can update their own retailer details" 
ON public.retailer_details 
FOR UPDATE
USING (
  -- Find profile ID via Supabase Auth
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = retailer_details.user_id
    AND (
      -- Either Supabase auth
      profiles.id = auth.uid() OR
      -- Or Firebase auth
      profiles.fire_id = (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text
    )
  )
)
WITH CHECK (
  -- Find profile ID via Supabase Auth
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = retailer_details.user_id
    AND (
      -- Either Supabase auth
      profiles.id = auth.uid() OR
      -- Or Firebase auth
      profiles.fire_id = (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text
    )
  )
);

-- Add similar policies for any other tables that require access (seller_details, orders, etc.)

-- Create a function to get the current user ID from either Supabase or Firebase auth
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
DECLARE
  supabase_uid UUID;
  firebase_uid TEXT;
  profile_id UUID;
BEGIN
  -- Try to get Supabase auth ID
  supabase_uid := auth.uid();
  
  -- If Supabase auth ID exists, return it
  IF supabase_uid IS NOT NULL THEN
    RETURN supabase_uid;
  END IF;
  
  -- Try to get Firebase UID from JWT claims
  BEGIN
    firebase_uid := (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text;
  EXCEPTION
    WHEN OTHERS THEN
      firebase_uid := NULL;
  END;
  
  -- If Firebase UID exists, lookup the corresponding profile ID
  IF firebase_uid IS NOT NULL THEN
    SELECT id INTO profile_id
    FROM profiles
    WHERE fire_id = firebase_uid;
    
    RETURN profile_id;
  END IF;
  
  -- Neither auth method found, return NULL
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 