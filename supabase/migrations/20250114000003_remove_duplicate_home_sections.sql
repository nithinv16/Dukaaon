-- Remove duplicate home sections and add unique constraint
-- This migration removes duplicates and prevents future duplicates

-- Step 1: Remove duplicate sections, keeping only the one with the lowest id (oldest)
-- Using ROW_NUMBER() window function since MIN() doesn't work with UUID
DELETE FROM home_sections
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY section_type, display_order, title 
        ORDER BY created_at ASC, id::text ASC
      ) as rn
    FROM home_sections
    WHERE is_active = true
  ) ranked
  WHERE rn > 1
);

-- Step 2: Add a unique constraint to prevent future duplicates
-- This ensures we can't have multiple sections with the same type, order, and title
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'home_sections_unique_section'
  ) THEN
    -- Add unique constraint on section_type, display_order, and title combination
    ALTER TABLE home_sections
    ADD CONSTRAINT home_sections_unique_section 
    UNIQUE (section_type, display_order, title);
    
    RAISE NOTICE 'Added unique constraint on home_sections';
  ELSE
    RAISE NOTICE 'Unique constraint already exists, skipping';
  END IF;
END $$;

-- Step 3: Log the cleanup
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM home_sections WHERE is_active = true;
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Duplicate sections removed';
  RAISE NOTICE 'Remaining active sections: %', remaining_count;
  RAISE NOTICE '===========================================';
END $$;

