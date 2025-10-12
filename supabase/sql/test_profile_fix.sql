-- Test script to verify the create_profile_unified function works correctly
-- After applying the fix, run this in Supabase SQL Editor to test

-- WARNING: This is a test script - it creates a temporary test user
--          Make sure to clean up after testing

-- Set up test data
WITH test_data AS (
  SELECT 
    'test_' || FLOOR(random() * 1000000)::TEXT AS test_suffix,
    'test' || FLOOR(random() * 1000000)::TEXT || '@example.com' AS test_email,
    '+123456789' || FLOOR(random() * 100)::TEXT AS test_phone
)
-- Call the fixed create_profile_unified function
SELECT 
  public.create_profile_unified(
    phone_number => test_phone,
    user_role => 'buyer',
    seller_data => '{}'::jsonb
  ) AS result
FROM test_data;

-- Check if the profile was created
-- (Note: You may need to replace the phone number with the one generated in the previous step)
SELECT 
  u.id AS user_id,
  u.phone,
  u.email,
  p.* 
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.phone LIKE '+123456789%'
ORDER BY u.created_at DESC
LIMIT 1;

-- Clean up (run this after testing to remove the test user)
-- DELETE FROM auth.users WHERE phone LIKE '+123456789%';
-- DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE phone LIKE '+123456789%');