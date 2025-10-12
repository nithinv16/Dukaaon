-- Trigger function to update location_address when location change request is approved

-- First, create the trigger function
CREATE OR REPLACE FUNCTION public.handle_location_change_request()
RETURNS TRIGGER AS $$
BEGIN
  -- If the request was just approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    -- Update the seller_details table with the new location
    UPDATE seller_details
    SET 
      latitude = NEW.new_latitude,
      longitude = NEW.new_longitude,
      location_address = NEW.new_address,
      updated_at = NOW()
    WHERE user_id = NEW.seller_id;
    
    -- Also update the profiles table
    UPDATE profiles
    SET 
      latitude = NEW.new_latitude,
      longitude = NEW.new_longitude,
      location_address = NEW.new_address,
      location_verified = true,
      updated_at = NOW()
    WHERE id = NEW.seller_id;
    
    RAISE NOTICE 'Location updated for seller ID: %', NEW.seller_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Then, create or replace the trigger
DO $$
BEGIN
  -- Drop the trigger if it exists
  DROP TRIGGER IF EXISTS location_change_trigger ON location_change_requests;
  
  -- Create the trigger
  CREATE TRIGGER location_change_trigger
  AFTER UPDATE ON location_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_location_change_request();
  
  RAISE NOTICE 'Created trigger for handling location change requests';
END $$; 