-- Test Webhook Orders SQL Script
-- This script helps test your Supabase webhook by inserting test orders

-- First, let's check if the is_ai_order column exists
-- (Run this to verify your migration was applied)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check current orders count
SELECT 
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE is_ai_order = true) as ai_orders,
    COUNT(*) FILTER (WHERE is_ai_order = false) as manual_orders
FROM orders;

-- Test 1: Insert an AI order (should trigger webhook)
INSERT INTO orders (
    user_id,
    retailer_id,
    seller_id,
    status,
    total_amount,
    is_ai_order,
    created_at,
    updated_at
) VALUES (
    'test-user-' || extract(epoch from now())::text,
    'test-retailer-456',
    'test-seller-789',
    'pending',
    125.50,
    true,  -- This is an AI order
    now(),
    now()
);

-- Test 2: Insert a manual order (should also trigger webhook)
INSERT INTO orders (
    user_id,
    retailer_id,
    seller_id,
    status,
    total_amount,
    is_ai_order,
    created_at,
    updated_at
) VALUES (
    'manual-user-' || extract(epoch from now())::text,
    'manual-retailer-123',
    'manual-seller-456',
    'confirmed',
    89.99,
    false,  -- This is a manual order
    now(),
    now()
);

-- Test 3: Update an existing order (should trigger webhook)
-- First, get the ID of the last inserted order
WITH last_order AS (
    SELECT id FROM orders ORDER BY created_at DESC LIMIT 1
)
UPDATE orders 
SET 
    status = 'processing',
    updated_at = now()
WHERE id = (SELECT id FROM last_order);

-- Test 4: Insert multiple AI orders for bulk testing
INSERT INTO orders (
    user_id,
    retailer_id,
    seller_id,
    status,
    total_amount,
    is_ai_order,
    created_at,
    updated_at
)
SELECT 
    'ai-user-' || generate_series,
    'ai-retailer-' || (generate_series % 3 + 1),
    'ai-seller-' || (generate_series % 2 + 1),
    CASE 
        WHEN generate_series % 4 = 0 THEN 'pending'
        WHEN generate_series % 4 = 1 THEN 'confirmed'
        WHEN generate_series % 4 = 2 THEN 'processing'
        ELSE 'completed'
    END,
    (random() * 500 + 50)::numeric(10,2),
    true,
    now() - (generate_series || ' minutes')::interval,
    now() - (generate_series || ' minutes')::interval
FROM generate_series(1, 5);

-- Verify the test data was inserted
SELECT 
    id,
    user_id,
    status,
    total_amount,
    is_ai_order,
    created_at
FROM orders 
WHERE user_id LIKE 'test-%' OR user_id LIKE 'manual-%' OR user_id LIKE 'ai-%'
ORDER BY created_at DESC;

-- Check updated statistics
SELECT 
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE is_ai_order = true) as ai_orders,
    COUNT(*) FILTER (WHERE is_ai_order = false) as manual_orders,
    AVG(total_amount) FILTER (WHERE is_ai_order = true) as avg_ai_order_value,
    AVG(total_amount) FILTER (WHERE is_ai_order = false) as avg_manual_order_value
FROM orders;

-- Use the analytics function we created
SELECT * FROM get_order_stats_by_source();

-- Clean up test data (uncomment to run)
/*
DELETE FROM orders 
WHERE user_id LIKE 'test-%' 
   OR user_id LIKE 'manual-%' 
   OR user_id LIKE 'ai-%';
*/

-- Monitor recent webhook triggers
-- Note: This query shows recent orders that should have triggered webhooks
SELECT 
    id,
    user_id,
    status,
    is_ai_order,
    total_amount,
    created_at,
    updated_at,
    CASE 
        WHEN created_at > now() - interval '1 hour' THEN 'Recent Insert'
        WHEN updated_at > created_at + interval '1 minute' THEN 'Recent Update'
        ELSE 'Older'
    END as webhook_trigger_type
FROM orders 
WHERE created_at > now() - interval '2 hours'
   OR updated_at > now() - interval '2 hours'
ORDER BY greatest(created_at, updated_at) DESC
LIMIT 20;