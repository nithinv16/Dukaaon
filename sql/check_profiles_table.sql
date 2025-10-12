-- Check actual structure of profiles table
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check a sample record
SELECT * FROM profiles LIMIT 1;

-- Get detailed JSONB structure
SELECT 
  id,
  jsonb_object_keys(business_details) as business_details_keys
FROM 
  profiles 
WHERE 
  business_details IS NOT NULL
  AND jsonb_typeof(business_details) = 'object'
LIMIT 20;

-- Check if the status column exists
SELECT column_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
AND column_name = 'status';

-- Get all column names for debugging
SELECT string_agg(column_name, ', ')
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'; 