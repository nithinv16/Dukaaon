-- =====================================================
-- FIX: Update purchase tracking to handle JSON items
-- The trigger was looking for order_items table but orders store items as JSON
-- Created: December 6, 2025
-- =====================================================

-- Drop the existing trigger that causes the error
DROP TRIGGER IF EXISTS on_order_created_track_purchase ON orders;

-- Create new function that handles JSON items column
CREATE OR REPLACE FUNCTION track_purchase_history()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
BEGIN
  -- Check if items column exists and is not null
  IF NEW.items IS NOT NULL AND jsonb_array_length(NEW.items::jsonb) > 0 THEN
    -- Insert into purchase_history for each item in the JSON array
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items::jsonb)
    LOOP
      INSERT INTO purchase_history (
        retailer_id,
        product_id,
        order_id,
        quantity,
        price,
        purchased_at
      )
      VALUES (
        NEW.user_id,
        (item->>'product_id')::UUID,
        NEW.id,
        COALESCE((item->>'quantity')::INTEGER, 1),
        COALESCE((item->>'price')::DECIMAL, (item->>'unit_price')::DECIMAL, 0),
        NEW.created_at
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the order creation
    RAISE WARNING 'Error tracking purchase history: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_order_created_track_purchase
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_purchase_history();

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Purchase tracking trigger updated to handle JSON items';
END $$;
