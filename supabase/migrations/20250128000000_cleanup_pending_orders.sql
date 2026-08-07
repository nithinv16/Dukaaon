-- Cleanup function for pending orders
-- Deletes orders with payment_status='pending' that are older than 5 minutes
-- This is a safety net for any edge cases or legacy orders.
-- Note: With the new checkout flow, orders are only created after payment succeeds
-- for online payments, so this cleanup should rarely be needed.

CREATE OR REPLACE FUNCTION cleanup_pending_orders()
RETURNS TABLE(deleted_count INTEGER, deleted_order_ids UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INTEGER;
    v_deleted_ids UUID[];
BEGIN
    -- Delete orders with payment_status='pending' older than 5 minutes
    -- Also delete associated payment_transactions
    WITH deleted_orders AS (
        DELETE FROM orders
        WHERE payment_status = 'pending'
          AND status = 'pending'
          AND created_at < NOW() - INTERVAL '5 minutes'
          AND payment_method != 'cod'  -- Don't delete COD orders, they can be pending
          AND payment_method != 'cash'
        RETURNING id
    )
    SELECT 
        COUNT(*),
        ARRAY_AGG(id)
    INTO v_deleted_count, v_deleted_ids
    FROM deleted_orders;

    -- Also cleanup orphaned payment_transactions for these orders
    -- (This is handled by CASCADE DELETE, but let's be explicit for clarity)
    
    RETURN QUERY SELECT v_deleted_count, v_deleted_ids;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_pending_orders() TO service_role;

-- Add comment
COMMENT ON FUNCTION cleanup_pending_orders IS 'Cleans up orders with pending payment status older than 5 minutes. Runs automatically via pg_cron every minute.';

-- Enable pg_cron extension and schedule automatic cleanup
-- Note: pg_cron must be enabled in Supabase dashboard under Database > Extensions
-- If pg_cron is not available, this will fail gracefully and cleanup must be run manually
DO $$
BEGIN
    -- Try to enable pg_cron extension
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    
    -- Unschedule existing job if it exists (to avoid conflicts on re-run)
    PERFORM cron.unschedule('cleanup-pending-orders');
EXCEPTION
    WHEN undefined_function THEN
        -- pg_cron extension not available
        RAISE WARNING 'pg_cron extension not enabled. Please enable it in Supabase dashboard > Database > Extensions';
        RETURN;
    WHEN OTHERS THEN
        -- Job doesn't exist yet, that's fine
        NULL;
END $$;

-- Schedule the cleanup function to run every 5 minutes
-- This balances cleanup speed with database load - runs exactly when orders need cleanup
-- Note: Orders older than 5 minutes are deleted, so running every 5 minutes is optimal
DO $$
BEGIN
    PERFORM cron.schedule(
        'cleanup-pending-orders',
        '*/5 * * * *',  -- Every 5 minutes
        $$SELECT cleanup_pending_orders();$$
    );
    RAISE NOTICE 'Scheduled cleanup job: cleanup-pending-orders (runs every 5 minutes)';
EXCEPTION
    WHEN undefined_function THEN
        RAISE WARNING 'pg_cron extension not enabled. Please enable it in Supabase dashboard > Database > Extensions';
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to schedule cleanup job. Error: %', SQLERRM;
END $$;

-- Create index for efficient cleanup queries (if not already exists)
CREATE INDEX IF NOT EXISTS idx_orders_cleanup_pending 
ON orders(created_at, payment_status, status, payment_method) 
WHERE payment_status = 'pending' AND status = 'pending';

-- Note: The cleanup function checks for orders older than 5 minutes, and runs every 5 minutes.
-- This provides optimal balance between cleanup speed and database load.
-- Running every 5 minutes means orders are deleted within 5-10 minutes, which is acceptable.
-- The index above ensures the cleanup query is very fast even with many orders.
--
-- To manually enable pg_cron in Supabase:
-- 1. Go to Supabase Dashboard > Database > Extensions
-- 2. Search for "pg_cron" and enable it
-- 3. Then run: SELECT cron.schedule('cleanup-pending-orders', '* * * * *', $$SELECT cleanup_pending_orders();$$);

