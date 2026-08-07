-- Check the trigger functions that are causing the error
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('handle_new_user', 'handle_profile_update')
ORDER BY routine_name;

-- Also check for any function that might reference 'phone' field
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_definition ILIKE '%NEW.phone%'
ORDER BY routine_name;