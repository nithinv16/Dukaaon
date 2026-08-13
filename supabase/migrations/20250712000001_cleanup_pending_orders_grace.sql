-- =============================================================================
-- Migration: Replace cleanup_pending_orders() with grace-window predicate
-- =============================================================================
--
-- WHY THE PREDICATE CHANGED
-- -------------------------
-- The old predicate was:
--
--   payment_status = 'pending'
--   AND status = 'pending'
--   AND created_at < NOW() - INTERVAL '5 minutes'
--   AND payment_method NOT IN ('cod','cash')
--
-- It was wrong in BOTH directions:
--
--   1. Too aggressive: a 5-minute window against a job running every 5 minutes
--      could delete a legitimate in-flight payment between Razorpay callback and
--      server-side verification — violating clause 3.6.
--
--   2. Too lenient: the checkout flow writes `status = 'placed'` (not 'pending'),
--      so orders that genuinely need cleanup (abandoned after Razorpay sheet
--      opened but never paid) were NEVER matched and accumulated forever.
--
-- Keying on `status` coupled cleanup to an unrelated lifecycle field that
-- sellers mutate ('placed' -> 'confirmed' -> 'shipped' -> 'delivered'). The
-- cleanup job has no business reasoning about fulfilment status.
--
-- WHY payment_initiated_at INSTEAD OF created_at OR status
-- ---------------------------------------------------------
-- `payment_initiated_at` is the in-flight marker set when the online payment
-- flow begins (Razorpay sheet opened). It is cleared atomically by
-- `mark_order_paid()` in the SAME UPDATE that sets `payment_status = 'paid'`.
-- This gives us a clean, single-column signal:
--
--   - NULL  → never started online payment (COD) OR already verified (paid)
--   - SET   → payment flow was initiated but not yet verified
--
-- `created_at` is wrong because the order may sit in a cart-to-order pipeline
-- for a variable time before payment begins. `status` is wrong because it
-- tracks fulfilment, not payment lifecycle.
--
-- WHY 15 MINUTES
-- --------------
-- The Razorpay checkout sheet has a configurable timeout (default ~5 min for
-- UPI, up to 10 min for netbanking). After the sheet closes, the client invokes
-- `verify-razorpay-payment`, which takes another 1-3 seconds. A 15-minute
-- grace window comfortably exceeds the worst-case path:
--
--   sheet timeout (10 min) + network retry (2 min) + verification (1 min) = 13 min
--
-- The old 5-minute window was shorter than a single netbanking sheet timeout.
--
-- THREE SAFETY PROPERTIES
-- -----------------------
-- The new predicate shape guarantees:
--
--   P1. A PAID order can never be deleted.
--       `mark_order_paid()` sets `payment_status = 'paid'` AND clears
--       `payment_initiated_at = NULL` in a single UPDATE. There is no window
--       where a row is paid and still matches the cleanup predicate.
--
--   P2. An IN-FLIGHT order can never be deleted.
--       15 minutes comfortably exceeds the Razorpay sheet lifetime plus
--       verification round-trip. The old 5-minute window against a 5-minute
--       cron schedule could race with legitimate slow payments.
--
--   P3. COD/cash orders are untouched.
--       The `payment_method NOT IN ('cod','cash')` guard is retained, AND
--       COD orders never have `payment_initiated_at` set (they skip the
--       Razorpay flow entirely), so they are doubly excluded.
--
-- Requirements: 2.5, 3.6
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop the old partial index (keyed on created_at + status)
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_orders_cleanup_pending;

-- -----------------------------------------------------------------------------
-- 2. Replace the cleanup function with the new grace-window predicate
-- -----------------------------------------------------------------------------
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
    -- Delete online-payment orders that have been in-flight for longer than
    -- the grace window. The predicate is:
    --   - payment_status still pending (not yet verified)
    --   - not COD/cash (those never enter the online payment flow)
    --   - payment_initiated_at is set (the Razorpay sheet was opened)
    --   - payment_initiated_at is older than 15 minutes (grace window expired)
    --
    -- This predicate cannot match a paid order (mark_order_paid clears
    -- payment_initiated_at in the same statement that sets status to paid)
    -- and cannot match an in-flight order within the grace window.
    WITH deleted_orders AS (
        DELETE FROM orders
        WHERE payment_status = 'pending'
          AND payment_method NOT IN ('cod', 'cash')
          AND payment_initiated_at IS NOT NULL
          AND payment_initiated_at < NOW() - INTERVAL '15 minutes'
        RETURNING id
    )
    SELECT
        COUNT(*)::INTEGER,
        ARRAY_AGG(id)
    INTO v_deleted_count, v_deleted_ids
    FROM deleted_orders;

    RETURN QUERY SELECT v_deleted_count, v_deleted_ids;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Permissions: only service_role can execute
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION cleanup_pending_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_pending_orders() TO service_role;

COMMENT ON FUNCTION cleanup_pending_orders IS
  'Cleans up abandoned online-payment orders whose payment_initiated_at '
  'exceeds the 15-minute grace window. Runs via pg_cron every 5 minutes. '
  'Cannot delete paid or in-flight orders by construction.';

-- -----------------------------------------------------------------------------
-- 4. Create a partial index matching the new predicate for efficient cleanup
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_cleanup_grace
ON orders (payment_initiated_at)
WHERE payment_status = 'pending'
  AND payment_method NOT IN ('cod', 'cash')
  AND payment_initiated_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. pg_cron schedule is NOT recreated here.
--    The existing 'cleanup-pending-orders' job calls
--    `SELECT cleanup_pending_orders();` which now executes the new body.
--    No schedule change needed — CREATE OR REPLACE swaps the function in place.
-- -----------------------------------------------------------------------------
