-- Function to clean up temporary profiles
-- This function cleans up profiles that may have been created as temporary workarounds
-- It identifies temporary profiles and properly links them or removes them

CREATE OR REPLACE FUNCTION public.cleanup_temporary_profiles()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cleanup_count INTEGER := 0;
    temp_profiles_cursor CURSOR FOR
        SELECT id, fire_id, phone_number 
        FROM profiles 
        WHERE fire_id IS NOT NULL 
        AND (business_details IS NULL OR business_details = '{}' OR business_details = 'null')
        ORDER BY created_at ASC;
    temp_rec RECORD;
    profile_record JSONB;
BEGIN
    -- Log start of cleanup
    RAISE NOTICE 'Starting temporary profile cleanup';
    
    -- Loop through temporary profiles
    FOR temp_rec IN temp_profiles_cursor LOOP
        -- Log the profile we're processing
        RAISE NOTICE 'Processing potential temporary profile: %, Phone: %', temp_rec.id, temp_rec.phone_number;
        
        -- Check if there are duplicate profiles with the same phone number
        IF EXISTS (
            SELECT 1 
            FROM profiles 
            WHERE phone_number = temp_rec.phone_number 
            AND id != temp_rec.id 
            AND (business_details IS NOT NULL AND business_details != '{}' AND business_details != 'null')
        ) THEN
            -- Found a more complete profile with the same phone number
            -- Transfer any data from temp profile to the main one and delete temp
            RAISE NOTICE 'Found duplicate profile with more data for phone: %', temp_rec.phone_number;
            
            -- Get the most complete profile
            SELECT to_jsonb(p.*) INTO profile_record
            FROM profiles p
            WHERE p.phone_number = temp_rec.phone_number 
            AND p.id != temp_rec.id
            AND (p.business_details IS NOT NULL AND p.business_details != '{}' AND p.business_details != 'null')
            ORDER BY created_at ASC
            LIMIT 1;
            
            -- Update the main profile with the Firebase ID if it's missing
            IF profile_record->>'fire_id' IS NULL AND temp_rec.fire_id IS NOT NULL THEN
                UPDATE profiles
                SET fire_id = temp_rec.fire_id,
                    updated_at = NOW()
                WHERE id = (profile_record->>'id')::uuid;
                
                RAISE NOTICE 'Updated main profile % with Firebase ID from temp profile', profile_record->>'id';
            END IF;
            
            -- Delete the temporary profile
            DELETE FROM profiles WHERE id = temp_rec.id;
            RAISE NOTICE 'Deleted temporary profile: %', temp_rec.id;
            
            cleanup_count := cleanup_count + 1;
        ELSE
            -- This is the only profile with this phone, keep it and mark it as cleaned
            RAISE NOTICE 'No duplicate found, marking profile % as cleaned', temp_rec.id;
            
            UPDATE profiles
            SET business_details = jsonb_build_object(
                    'cleaned', true,
                    'shopName', 'My Shop',
                    'cleanedAt', NOW()
                ),
                updated_at = NOW()
            WHERE id = temp_rec.id;
            
            cleanup_count := cleanup_count + 1;
        END IF;
    END LOOP;
    
    -- Return summary
    RETURN jsonb_build_object(
        'success', true,
        'count', cleanup_count,
        'message', 'Cleaned up ' || cleanup_count || ' temporary profiles'
    );
EXCEPTION WHEN OTHERS THEN
    -- Handle any errors
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'message', 'Error during temporary profile cleanup'
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.cleanup_temporary_profiles TO service_role; 