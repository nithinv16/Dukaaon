-- Add delivery_fee column to orders table if it doesn't exist
-- This ensures individual orders can have their own delivery fee allocation

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;

-- Add a check constraint to ensure delivery_fee is non-negative
ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS chk_orders_delivery_fee_non_negative 
CHECK (delivery_fee >= 0);

-- Create an index for queries that filter by delivery_fee
CREATE INDEX IF NOT EXISTS idx_orders_delivery_fee 
ON orders(delivery_fee);

-- Add comment for documentation
COMMENT ON COLUMN orders.delivery_fee IS 'Delivery fee allocated to this specific order. Only the farthest seller in a batch should have a non-zero value.';