-- Script to migrate existing location data to the location_address column in seller_details

-- First ensure the location_address column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'seller_details' AND column_name = 'location_address'
  ) THEN
    ALTER TABLE seller_details ADD COLUMN location_address TEXT;
    RAISE NOTICE 'Added location_address column to seller_details table';
  END IF;
END $$;

-- Fill in location_address from profiles table where available and not already set
UPDATE seller_details sd
SET location_address = p.location_address
FROM profiles p
WHERE sd.user_id = p.id
  AND p.location_address IS NOT NULL
  AND sd.location_address IS NULL;

-- For records that still have NULL location_address, try to convert the address field
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

-- Log how many records were updated
DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM seller_details WHERE location_address IS NOT NULL;
  RAISE NOTICE 'Updated % seller_details records with location_address', updated_count;
END $$; 