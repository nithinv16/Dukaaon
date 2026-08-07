-- EMERGENCY DIAGNOSIS for persistent "Database error saving new user"
-- This script will help identify the exact cause of the ongoing signup failure

-- 1. Check if our triggers were actually created
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name IN ('on_auth_user_created', 'on_profile_update')
ORDER BY trigger_name;

-- 2. Check if our functions exist
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name IN ('handle_new_auth_user', 'handle_profile_update')
AND routine_schema = 'public';

-- 3. Check the profiles table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check foreign key constraints
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'profiles';

-- 5. Check if we can access auth.users table (this might be the issue)
SELECT COUNT(*) as auth_users_count FROM auth.users;

-- 6. Check RLS policies on profiles table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 7. Test basic profile insertion with a dummy UUID
-- This will help us understand what's failing
INSERT INTO public.profiles (
    id,
    phone_number,
    role,
    language,
    status,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '+1234567890',
    'retailer',
    'en',
    'active',
    NOW(),
    NOW()
) 
ON CONFLICT (id) DO NOTHING
RETURNING id, phone_number, role;