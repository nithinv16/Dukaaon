-- Fix Database Schema - Create missing tables and functions
-- This script creates the profiles table and all required functions

-- 1. Create the profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'retailer',
    status TEXT DEFAULT 'active',
    business_details JSONB DEFAULT '{}',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_address TEXT,
    language TEXT DEFAULT 'en',
    fcm_token TEXT,
    shop_image_url TEXT,
    kyc_document_urls JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(latitude, longitude);

-- 3. Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (
        phone_number = (current_setting('request.jwt.claims', true)::json->>'phone')::text
        OR auth.uid()::text = id::text
    );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (
        phone_number = (current_setting('request.jwt.claims', true)::json->>'phone')::text
        OR auth.uid()::text = id::text
    );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (
        phone_number = (current_setting('request.jwt.claims', true)::json->>'phone')::text
        OR auth.uid()::text = id::text
    );

-- 5. Create the main profile creation function
CREATE OR REPLACE FUNCTION public.create_user_profile(
    user_phone TEXT,
    user_role TEXT DEFAULT 'retailer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_record JSONB;
    existing_id UUID;
    auth_user_id UUID;
BEGIN
    RAISE NOTICE 'Creating/updating profile for Phone: %, Role: %', 
                  user_phone, user_role;

    -- Check if auth.users entry exists with phone number
    SELECT id INTO auth_user_id
    FROM auth.users
    WHERE phone = user_phone;
    
    IF auth_user_id IS NULL THEN
        -- Create new auth.users entry first
        auth_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id,
            instance_id,
            role,
            aud,
            email,
            phone,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            auth_user_id::text || '@placeholder.com',
            user_phone,
            jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']),
            jsonb_build_object('role', user_role),
            NOW(),
            NOW()
        );
    END IF;

    -- Check if profile exists
    SELECT id INTO existing_id
    FROM public.profiles
    WHERE id = auth_user_id;
    
    IF existing_id IS NOT NULL THEN
        -- Update existing profile
        UPDATE public.profiles
        SET 
            role = user_role,
            updated_at = NOW()
        WHERE id = existing_id
        RETURNING to_jsonb(profiles.*) INTO profile_record;
    ELSE
        -- Create new profile with auth.users id
        INSERT INTO public.profiles (
            id,
            phone_number,
            role,
            status,
            business_details
        )
        VALUES (
            auth_user_id,
            user_phone,
            user_role,
            'active',
            jsonb_build_object(
                'shopName', 'My Shop',
                'address', 'Address pending'
            )
        )
        RETURNING to_jsonb(profiles.*) INTO profile_record;
    END IF;

    RETURN profile_record;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in create_user_profile: %', SQLERRM;
END;
$$;

-- 6. Create alternative profile creation functions with different parameter signatures
CREATE OR REPLACE FUNCTION public.fix_profile_creation(
    phone_number TEXT,
    user_role TEXT DEFAULT 'retailer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    profile_record JSONB;
    existing_id UUID;
    auth_user_id UUID;
BEGIN
    RAISE NOTICE 'Creating/updating profile for Phone: %, Role: %', 
                  phone_number, user_role;

    -- Check if auth.users entry exists with phone number
    SELECT id INTO auth_user_id
    FROM auth.users
    WHERE phone = phone_number;
    
    IF auth_user_id IS NULL THEN
        -- Create new auth.users entry first
        auth_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id,
            instance_id,
            role,
            aud,
            email,
            phone,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            auth_user_id::text || '@placeholder.com',
            phone_number,
            jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']),
            jsonb_build_object('role', user_role),
            NOW(),
            NOW()
        );
    END IF;

    -- Check if profile exists
    SELECT id INTO existing_id
    FROM public.profiles
    WHERE id = auth_user_id;
    
    IF existing_id IS NOT NULL THEN
        -- Update existing profile
        UPDATE public.profiles
        SET 
            role = user_role,
            updated_at = NOW()
        WHERE id = existing_id
        RETURNING to_jsonb(profiles.*) INTO profile_record;
    ELSE
        -- Create new profile with auth.users id
        INSERT INTO public.profiles (
            id,
            phone_number,
            role,
            status,
            business_details
        )
        VALUES (
            auth_user_id,
            phone_number,
            user_role,
            'active',
            jsonb_build_object(
                'shopName', 'My Shop',
                'address', 'Address pending'
            )
        )
        RETURNING to_jsonb(profiles.*) INTO profile_record;
    END IF;

    RETURN profile_record;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in fix_profile_creation: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user_profile_direct(
    phone_number TEXT,
    user_role TEXT DEFAULT 'retailer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.fix_profile_creation(phone_number, user_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_profile_no_constraint(
    phone_number TEXT,
    user_role TEXT DEFAULT 'retailer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.fix_profile_creation(phone_number, user_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_retailer_profile(
    phone_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.fix_profile_creation(phone_number, 'retailer');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_seller_profile(
    phone_number TEXT,
    seller_data JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    profile_record JSONB;
    profile_id UUID;
    seller_record JSONB;
BEGIN
    -- First create the profile
    profile_record := public.fix_profile_creation(phone_number, 'seller');
    profile_id := (profile_record->>'id')::UUID;
    
    -- Check if seller_details table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seller_details') THEN
        -- Insert or update seller_details with user_id referencing profiles(id)
        INSERT INTO public.seller_details (
            user_id,
            seller_type,
            business_name,
            owner_name,
            location_address,
            latitude,
            longitude,
            created_at,
            updated_at
        )
        VALUES (
            profile_id,  -- user_id references profiles(id)
            COALESCE(
                seller_data->>'seller_type', 
                CASE 
                    WHEN user_role = 'seller' THEN 'wholesaler'
                    WHEN user_role = 'wholesaler' THEN 'wholesaler'
                    WHEN user_role = 'manufacturer' THEN 'manufacturer'
                    ELSE 'wholesaler'
                END
            ),
            seller_data->>'business_name',
            seller_data->>'owner_name',
            COALESCE(seller_data->>'location_address', 'Address pending'),
            COALESCE((seller_data->>'latitude')::DECIMAL, NULL),
            COALESCE((seller_data->>'longitude')::DECIMAL, NULL),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            seller_type = COALESCE(
                seller_data->>'seller_type', 
                CASE 
                    WHEN user_role = 'seller' THEN 'wholesaler'
                    WHEN user_role = 'wholesaler' THEN 'wholesaler'
                    WHEN user_role = 'manufacturer' THEN 'manufacturer'
                    ELSE 'wholesaler'
                END
            ),
            business_name = seller_data->>'business_name',
            owner_name = seller_data->>'owner_name',
            location_address = COALESCE(seller_data->>'location_address', 'Address pending'),
            latitude = COALESCE((seller_data->>'latitude')::DECIMAL, NULL),
            longitude = COALESCE((seller_data->>'longitude')::DECIMAL, NULL),
            updated_at = NOW()
        RETURNING to_jsonb(seller_details.*) INTO seller_record;
        
        -- Return combined profile and seller_details
        RETURN jsonb_build_object(
            'profile', profile_record,
            'seller_details', seller_record
        );
    ELSE
        -- If seller_details table doesn't exist, just return profile
        RETURN profile_record;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in create_seller_profile: %', SQLERRM;
END;
$$;

-- 7. Create unified profile creation function
CREATE OR REPLACE FUNCTION public.create_profile_unified(
    phone_number TEXT,
    user_role TEXT DEFAULT 'retailer',
    seller_data JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    profile_record JSONB;
    profile_id UUID;
    seller_record JSONB;
    existing_id UUID;
    auth_user_id UUID;
BEGIN
    RAISE NOTICE 'Creating/updating profile for Phone: %, Role: %', 
                  phone_number, user_role;

    -- Check if auth.users entry exists with phone number
    SELECT id INTO auth_user_id
    FROM auth.users
    WHERE phone = phone_number;
    
    IF auth_user_id IS NULL THEN
        -- Create new auth.users entry first
        auth_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id,
            instance_id,
            role,
            aud,
            email,
            phone,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            auth_user_id::text || '@placeholder.com',
            phone_number,
            jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']),
            jsonb_build_object('role', user_role),
            NOW(),
            NOW()
        );
    END IF;

    -- Check if profile exists
    SELECT id INTO existing_id
    FROM public.profiles
    WHERE id = auth_user_id;
    
    IF existing_id IS NOT NULL THEN
        -- Update existing profile
        UPDATE public.profiles
        SET 
            role = user_role,
            updated_at = NOW()
        WHERE id = existing_id
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        profile_id := existing_id;
    ELSE
        -- Create new profile with auth.users id
        INSERT INTO public.profiles (
            id,
            phone_number,
            role,
            status,
            business_details,
            created_at,
            updated_at
        )
        VALUES (
            auth_user_id,
            phone_number,
            user_role,
            'active',
            CASE 
                WHEN user_role = 'retailer' THEN jsonb_build_object(
                    'shopName', 'My Shop',
                    'address', 'Address pending'
                )
                ELSE '{}'
            END,
            NOW(),
            NOW()
        )
        RETURNING to_jsonb(profiles.*) INTO profile_record;
        
        profile_id := auth_user_id;
    END IF;

    -- Handle seller-specific logic
    IF user_role IN ('seller', 'wholesaler') THEN
        -- Check if seller_details table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seller_details') THEN
            -- Insert or update seller_details with user_id referencing profiles(id)
            INSERT INTO public.seller_details (
                user_id,
                seller_type,
                business_name,
                owner_name,
                location_address,
                latitude,
                longitude,
                created_at,
                updated_at
            )
            VALUES (
                profile_id,  -- user_id references profiles(id)
                COALESCE(
                    seller_data->>'seller_type', 
                    CASE 
                        WHEN user_role = 'seller' THEN 'wholesaler'
                        WHEN user_role = 'wholesaler' THEN 'wholesaler'
                        WHEN user_role = 'manufacturer' THEN 'manufacturer'
                        ELSE 'wholesaler'
                    END
                ),
                seller_data->>'business_name',
                seller_data->>'owner_name',
                COALESCE(seller_data->>'location_address', 'Address pending'),
                COALESCE((seller_data->>'latitude')::DECIMAL, NULL),
                COALESCE((seller_data->>'longitude')::DECIMAL, NULL),
                NOW(),
                NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
                seller_type = COALESCE(
                    seller_data->>'seller_type', 
                    CASE 
                        WHEN user_role = 'seller' THEN 'wholesaler'
                        WHEN user_role = 'wholesaler' THEN 'wholesaler'
                        WHEN user_role = 'manufacturer' THEN 'manufacturer'
                        ELSE 'wholesaler'
                    END
                ),
                business_name = seller_data->>'business_name',
                owner_name = seller_data->>'owner_name',
                location_address = COALESCE(seller_data->>'location_address', 'Address pending'),
                latitude = COALESCE((seller_data->>'latitude')::DECIMAL, NULL),
                longitude = COALESCE((seller_data->>'longitude')::DECIMAL, NULL),
                updated_at = NOW()
            RETURNING to_jsonb(seller_details.*) INTO seller_record;
            
            -- Return combined profile and seller_details
            RETURN jsonb_build_object(
                'success', true,
                'profile', profile_record,
                'seller_details', seller_record,
                'message', 'Profile and seller details created/updated successfully'
            );
        END IF;
    END IF;

    -- Return just profile for non-sellers or when seller_details table doesn't exist
    RETURN jsonb_build_object(
        'success', true,
        'profile', profile_record,
        'message', 'Profile created/updated successfully'
    );
EXCEPTION
    WHEN unique_violation THEN
        -- Handle duplicate key violations gracefully
        RAISE NOTICE 'Duplicate key violation, attempting to fetch existing profile';
        
        SELECT to_jsonb(profiles.*) INTO profile_record
        FROM public.profiles
        WHERE phone_number = create_profile_unified.phone_number;
        
        IF profile_record IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'profile', profile_record,
                'message', 'Existing profile found and returned'
            );
        ELSE
            RAISE EXCEPTION 'Profile creation failed: duplicate key violation';
        END IF;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in create_profile_unified: %', SQLERRM;
END;
$$;

-- 8. Create diagnostic function with correct signature
CREATE OR REPLACE FUNCTION public.diagnose_profile_creation(
    phone_number TEXT,
    user_role TEXT DEFAULT 'retailer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    table_exists BOOLEAN;
    auth_table_exists BOOLEAN;
    profile_count INTEGER;
    auth_user_count INTEGER;
    existing_profile JSONB;
    existing_auth_user JSONB;
    constraint_info JSONB;
BEGIN
    -- Check if profiles table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) INTO table_exists;
    
    -- Check if auth.users table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' 
        AND table_name = 'users'
    ) INTO auth_table_exists;
    
    -- Count existing records
    IF table_exists THEN
        SELECT COUNT(*) INTO profile_count FROM public.profiles;
        
        -- Check if profile exists for this phone number
        SELECT to_jsonb(profiles.*) INTO existing_profile
        FROM public.profiles
        WHERE profiles.phone_number = diagnose_profile_creation.phone_number;
    ELSE
        profile_count := -1;
        existing_profile := NULL;
    END IF;
    
    IF auth_table_exists THEN
        SELECT COUNT(*) INTO auth_user_count FROM auth.users;
        
        -- Check if auth user exists for this phone number
        SELECT to_jsonb(users.*) INTO existing_auth_user
        FROM auth.users users
        WHERE users.phone = diagnose_profile_creation.phone_number;
    ELSE
        auth_user_count := -1;
        existing_auth_user := NULL;
    END IF;
    
    -- Get constraint information
    SELECT jsonb_agg(
        jsonb_build_object(
            'constraint_name', constraint_name,
            'constraint_type', constraint_type,
            'table_name', table_name,
            'column_name', column_name
        )
    ) INTO constraint_info
    FROM (
        SELECT 
            tc.constraint_name,
            tc.constraint_type,
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'profiles'
        AND tc.table_schema = 'public'
    ) constraints;
    
    result := jsonb_build_object(
        'profiles_table_exists', table_exists,
        'auth_users_table_exists', auth_table_exists,
        'profile_count', profile_count,
        'auth_user_count', auth_user_count,
        'phone_number', phone_number,
        'user_role', user_role,
        'existing_profile', existing_profile,
        'existing_auth_user', existing_auth_user,
        'constraints', constraint_info,
        'timestamp', NOW()
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'phone_number', phone_number,
            'timestamp', NOW()
        );
END;
$$;

-- 9. Grant permissions to all functions
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fix_profile_creation TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_user_profile_direct TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_profile_no_constraint TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_retailer_profile TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_seller_profile TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_profile_unified TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.diagnose_profile_creation TO authenticated, anon;

-- 10. Create user_profiles table alias for compatibility
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT * FROM public.profiles;

-- 11. Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated, anon;

-- 12. Display completion messages
DO $$
BEGIN
    RAISE NOTICE 'Database schema fix completed successfully!';
    RAISE NOTICE 'Created profiles table with all required columns';
    RAISE NOTICE 'Created unified profile creation function: create_profile_unified';
    RAISE NOTICE 'Created all missing profile creation functions';
    RAISE NOTICE 'Set up proper RLS policies';
    RAISE NOTICE 'Ready for profile creation operations';
END
$$;