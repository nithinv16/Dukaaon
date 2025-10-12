-- SQL Script to diagnose profile and auth.users issues
-- Run this in the Supabase SQL Editor to understand the state of your database

-- Check if there are any profiles with IDs that don't exist in auth.users
SELECT 
  p.id AS profile_id,
  p.fire_id AS firebase_id,
  p.phone_number,
  p.role,
  p.status,
  p.created_at
FROM 
  profiles p
LEFT JOIN 
  auth.users u ON p.id = u.id
WHERE 
  u.id IS NULL
ORDER BY 
  p.created_at DESC
LIMIT 10;

-- Find auth.users entries that don't have corresponding profiles
-- These could be used for creating new profiles
SELECT 
  u.id AS user_id,
  u.email,
  u.phone,
  u.created_at,
  u.last_sign_in_at
FROM 
  auth.users u
LEFT JOIN 
  profiles p ON u.id = p.id
WHERE 
  p.id IS NULL
ORDER BY 
  u.created_at DESC
LIMIT 10;

-- Check if any profiles have duplicate phone numbers
SELECT 
  phone_number, 
  COUNT(*) as count,
  array_agg(id) as profile_ids,
  array_agg(fire_id) as firebase_ids
FROM 
  profiles 
GROUP BY 
  phone_number 
HAVING 
  COUNT(*) > 1
ORDER BY 
  COUNT(*) DESC;

-- Test creating a profile with an existing auth.users ID
-- Run this as a separate query since it modifies data
/*
DO $$
DECLARE
  user_id UUID;
BEGIN
  -- Find an existing auth.users ID not used in profiles
  SELECT u.id INTO user_id
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE p.id IS NULL
  LIMIT 1;
  
  IF user_id IS NOT NULL THEN
    RAISE NOTICE 'Found auth.users ID to use: %', user_id;
    
    -- Try inserting a test profile
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
      'test_firebase_id',
      '1234567890',
      'retailer',
      'active',
      NOW(),
      NOW(),
      '{}'
    );
    
    RAISE NOTICE 'Successfully created test profile with ID: %', user_id;
  ELSE
    RAISE NOTICE 'No available auth.users IDs found';
  END IF;
  
  -- Roll back the transaction so we don't actually create the test profile
  RAISE EXCEPTION 'Rolling back transaction - this is just a test';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'Rolling back transaction - this is just a test' THEN
      RAISE NOTICE 'Test completed successfully';
    ELSE
      RAISE NOTICE 'Error: %', SQLERRM;
    END IF;
END;
$$;
*/ 