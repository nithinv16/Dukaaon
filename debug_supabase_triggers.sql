-- Debug script to check current state of Supabase triggers and functions
-- Run this in Supabase SQL Editor to diagnose the signup error

-- 1. Check if our functions exist
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('handle_new_user', 'handle_profile_update');

-- 2. Check if triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'profiles'
AND trigger_schema = 'public';

-- 3. Check profiles table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Check for any constraints that might be failing
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
AND table_name = 'profiles';

-- 5. Test profile creation with minimal data
DO $$
DECLARE
    test_id UUID := gen_random_uuid();
    test_phone TEXT := '+1234567890';
BEGIN
    RAISE NOTICE 'Testing profile creation...';
    
    -- Try to insert a minimal profile
    BEGIN
        INSERT INTO public.profiles (
            id,
            phone_number
        ) VALUES (
            test_id,
            test_phone
        );
        
        RAISE NOTICE 'SUCCESS: Minimal profile created successfully';
        
        -- Clean up
        DELETE FROM public.profiles WHERE id = test_id;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Profile creation failed: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
        
        -- Try to clean up in case of partial insert
        BEGIN
            DELETE FROM public.profiles WHERE id = test_id;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore cleanup errors
        END;
    END;
END;
$$;

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
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- 7. Check if there are any foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'profiles'
AND tc.table_schema = 'public';

-- 8. Display summary
DO $$
BEGIN
    RAISE NOTICE '=== SUPABASE TRIGGER DEBUG COMPLETE ===';
    RAISE NOTICE 'Check the output above for:';
    RAISE NOTICE '1. Function definitions (should show handle_new_user and handle_profile_update)';
    RAISE NOTICE '2. Trigger configurations (should show on_profile_insert and on_profile_update)';
    RAISE NOTICE '3. Table structure (should include language column)';
    RAISE NOTICE '4. Profile creation test results';
    RAISE NOTICE '5. RLS policies and constraints';
    RAISE NOTICE '';
    RAISE NOTICE 'If any section shows unexpected results, that may be the cause of the signup error.';
END;
$$;