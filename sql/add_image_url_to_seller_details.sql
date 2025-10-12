-- Add image_url column to seller_details table if it doesn't exist

DO $$
BEGIN
  -- Check if image_url column exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'seller_details' AND column_name = 'image_url'
  ) THEN
    -- Add the column
    ALTER TABLE seller_details ADD COLUMN image_url TEXT;
    
    -- Copy existing shop_image values from profiles table to seller_details.image_url
    UPDATE seller_details 
    SET image_url = profiles.shop_image
    FROM profiles 
    WHERE seller_details.user_id = profiles.id 
    AND profiles.shop_image IS NOT NULL
    AND seller_details.image_url IS NULL;
    
    -- Log the change
    RAISE NOTICE 'Added image_url column to seller_details table and migrated data from profiles.shop_image';
  ELSE
    RAISE NOTICE 'image_url column already exists in seller_details table';
  END IF;
END $$;