-- Add user_id column to orders table
-- This migration adds the missing user_id column that the application expects

-- Add the user_id column to the orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add a comment to document the column purpose
COMMENT ON COLUMN orders.user_id IS 'Reference to the user who placed the order (from auth.users)';

-- Create an index for better query performance when filtering by user_id
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Create a composite index for user orders by date
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at ON orders(user_id, created_at DESC);

-- Update RLS policies to include user_id access
-- Allow users to view their own orders
CREATE POLICY "Users can view their own orders by user_id" ON orders
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert orders with their own user_id
CREATE POLICY "Users can insert orders with their user_id" ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own orders
CREATE POLICY "Users can update their own orders by user_id" ON orders
    FOR UPDATE USING (auth.uid() = user_id);

-- Migrate existing data: Set user_id based on customer_id or seller_id
-- This is a best-effort migration - you may need to adjust based on your business logic
UPDATE orders 
SET user_id = customer_id 
WHERE user_id IS NULL AND customer_id IS NOT NULL;

-- For orders without customer_id, use seller_id as fallback
UPDATE orders 
SET user_id = seller_id 
WHERE user_id IS NULL AND seller_id IS NOT NULL;