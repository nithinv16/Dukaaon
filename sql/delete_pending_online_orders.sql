-- SQL Queries to Delete Pending Online Payment Orders
-- These queries handle foreign key relationships with seller_notifications table

-- ============================================================================
-- OPTION 1: Delete seller_notifications first, then orders (RECOMMENDED)
-- ============================================================================
-- This is the safest approach if foreign keys don't have CASCADE DELETE

-- Step 1: Delete related seller_notifications records first
DELETE FROM seller_notifications
WHERE order_id IN (
    SELECT id 
    FROM orders 
    WHERE payment_status = 'pending' 
      AND payment_method = 'online'
);

-- Step 2: Delete the orders
DELETE FROM orders
WHERE payment_status = 'pending' 
  AND payment_method = 'online';

-- ============================================================================
-- OPTION 2: Single query using CTE (Cleaner, but requires FK to allow deletion)
-- ============================================================================
WITH orders_to_delete AS (
    SELECT id 
    FROM orders 
    WHERE payment_status = 'pending' 
      AND payment_method = 'online'
)
DELETE FROM orders
WHERE id IN (SELECT id FROM orders_to_delete);

-- Note: If seller_notifications has ON DELETE CASCADE, this will automatically
-- delete related notifications. Otherwise, run Option 1.

-- ============================================================================
-- OPTION 3: Using a transaction for safety (RECOMMENDED for production)
-- ============================================================================
BEGIN;

-- Delete seller_notifications first
DELETE FROM seller_notifications
WHERE order_id IN (
    SELECT id 
    FROM orders 
    WHERE payment_status = 'pending' 
      AND payment_method = 'online'
);

-- Delete orders
DELETE FROM orders
WHERE payment_status = 'pending' 
  AND payment_method = 'online';

-- Check the result before committing
-- SELECT COUNT(*) FROM orders WHERE payment_status = 'pending' AND payment_method = 'online';
-- If everything looks good, commit:
COMMIT;
-- If something went wrong, rollback:
-- ROLLBACK;

-- ============================================================================
-- OPTION 4: Preview what will be deleted (SAFE - No deletions)
-- ============================================================================
-- Run this first to see what will be deleted

-- Preview orders to be deleted
SELECT 
    id,
    order_number,
    user_id,
    seller_id,
    total_amount,
    payment_status,
    payment_method,
    status,
    created_at
FROM orders
WHERE payment_status = 'pending' 
  AND payment_method = 'online';

-- Preview seller_notifications to be deleted
SELECT 
    sn.id,
    sn.order_id,
    sn.seller_id,
    sn.type,
    sn.message,
    sn.status,
    sn.created_at,
    o.order_number
FROM seller_notifications sn
INNER JOIN orders o ON sn.order_id = o.id
WHERE o.payment_status = 'pending' 
  AND o.payment_method = 'online';

-- Count how many records will be deleted
SELECT 
    (SELECT COUNT(*) FROM orders WHERE payment_status = 'pending' AND payment_method = 'online') as orders_count,
    (SELECT COUNT(*) FROM seller_notifications sn 
     INNER JOIN orders o ON sn.order_id = o.id 
     WHERE o.payment_status = 'pending' AND o.payment_method = 'online') as notifications_count;

-- ============================================================================
-- OPTION 5: Delete with time constraint (Delete orders older than X minutes)
-- ============================================================================
-- Useful if you want to delete only old pending orders

BEGIN;

-- Delete seller_notifications for orders older than 5 minutes
DELETE FROM seller_notifications
WHERE order_id IN (
    SELECT id 
    FROM orders 
    WHERE payment_status = 'pending' 
      AND payment_method = 'online'
      AND created_at < NOW() - INTERVAL '5 minutes'
);

-- Delete orders older than 5 minutes
DELETE FROM orders
WHERE payment_status = 'pending' 
  AND payment_method = 'online'
  AND created_at < NOW() - INTERVAL '5 minutes';

COMMIT;

-- ============================================================================
-- OPTION 6: Function-based approach (Like cleanup_pending_orders)
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_pending_online_orders()
RETURNS TABLE(
    deleted_orders_count INTEGER,
    deleted_notifications_count INTEGER,
    deleted_order_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_ids UUID[];
    v_orders_count INTEGER;
    v_notifications_count INTEGER;
BEGIN
    -- Get order IDs to delete
    SELECT ARRAY_AGG(id)
    INTO v_order_ids
    FROM orders
    WHERE payment_status = 'pending' 
      AND payment_method = 'online';
    
    -- Delete seller_notifications
    DELETE FROM seller_notifications
    WHERE order_id = ANY(v_order_ids);
    
    GET DIAGNOSTICS v_notifications_count = ROW_COUNT;
    
    -- Delete orders
    DELETE FROM orders
    WHERE id = ANY(v_order_ids);
    
    GET DIAGNOSTICS v_orders_count = ROW_COUNT;
    
    RETURN QUERY SELECT v_orders_count, v_notifications_count, v_order_ids;
END;
$$;

-- Execute the function
-- SELECT * FROM delete_pending_online_orders();

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Payment method values in your system: 'cash', 'cod', 'online', 'upi'
--    - 'online' is used for Razorpay and other online payment methods
--    - 'cod' and 'cash' are for Cash on Delivery
--
-- 2. If seller_notifications has ON DELETE CASCADE on order_id:
--    - You can directly delete from orders and notifications will be deleted automatically
--    - Option 2 or 6 would work directly
--
-- 3. If seller_notifications has ON DELETE RESTRICT or NO ACTION:
--    - You must delete notifications first, then orders
--    - Use Option 1, 3, or 5
--
-- 4. To check the foreign key constraint:
--    SELECT
--        tc.constraint_name,
--        tc.table_name,
--        kcu.column_name,
--        ccu.table_name AS foreign_table_name,
--        ccu.column_name AS foreign_column_name,
--        rc.delete_rule
--    FROM information_schema.table_constraints AS tc
--    JOIN information_schema.key_column_usage AS kcu
--        ON tc.constraint_name = kcu.constraint_name
--    JOIN information_schema.constraint_column_usage AS ccu
--        ON ccu.constraint_name = tc.constraint_name
--    JOIN information_schema.referential_constraints AS rc
--        ON rc.constraint_name = tc.constraint_name
--    WHERE tc.table_name = 'seller_notifications'
--      AND tc.constraint_type = 'FOREIGN KEY'
--      AND kcu.column_name = 'order_id';

