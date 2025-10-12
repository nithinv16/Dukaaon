-- Add location_address column to seller_details table if it doesn't exist

DO $$
BEGIN
  -- Check if location_address column exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'seller_details' AND column_name = 'location_address'
  ) THEN
    -- Add the column
    ALTER TABLE seller_details ADD COLUMN location_address TEXT;
    
    -- Copy existing address values to location_address as a starting point
    -- For JSONB address fields, extract as text or leave NULL
    UPDATE seller_details 
    SET location_address = 
      CASE
        WHEN address IS NULL THEN NULL
        WHEN jsonb_typeof(address::jsonb) = 'object' THEN 
          COALESCE(address->>'street', '') || ', ' || 
          COALESCE(address->>'city', '') || ', ' || 
          COALESCE(address->>'state', '') || ', ' || 
          COALESCE(address->>'pincode', '')
        WHEN jsonb_typeof(address::jsonb) = 'string' THEN address::text
        ELSE address::text
      END
    WHERE location_address IS NULL;
    
    -- Log the change
    RAISE NOTICE 'Added location_address column to seller_details table';
  ELSE
    RAISE NOTICE 'location_address column already exists in seller_details table';
  END IF;
END $$; 