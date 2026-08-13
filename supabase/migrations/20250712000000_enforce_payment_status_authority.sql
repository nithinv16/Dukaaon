-- =============================================================================
-- Migration: enforce_payment_status_authority
-- Date: 2025-07-12
-- Purpose: Make the database the sole authority over payment_status = 'paid'.
--
-- Design rationale (from spec):
--   The client currently writes payment_status = 'paid' BEFORE verification.
--   This migration inverts that: the client creates orders at 'pending', and
--   only the server (via mark_order_paid, called by verify-razorpay-payment)
--   can transition to 'paid'. A BEFORE trigger enforces this at the row level.
--
--   Why a trigger and not RLS or column grants:
--   - RLS WITH CHECK cannot express "every column except this one" and would
--     need duplication across all UPDATE policies (high regression risk on
--     seller flows).
--   - Column-level REVOKE INSERT(payment_status) fails ANY insert naming the
--     column, including the COD path that legitimately writes 'pending'.
--   - Only a trigger discriminates on both operation type and value.
--
-- Schema assumptions (confirmed in SCHEMA_FINDINGS.md, task 10):
--   - orders.payment_initiated_at does NOT exist → added here
--   - master_orders.payment_initiated_at does NOT exist → added here
--   - payment_transactions.transaction_id unique index likely does NOT exist
--     → added here with IF NOT EXISTS
--   - payment_transactions columns: id, order_id, amount, status,
--     transaction_id, payment_method, created_at, updated_at
--   - No existing trigger on payment_status
--   - No existing mark_order_paid function
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add payment_initiated_at column to orders and master_orders
--    Nullable so existing rows are unaffected.
-- -----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_initiated_at TIMESTAMPTZ;

ALTER TABLE public.master_orders
  ADD COLUMN IF NOT EXISTS payment_initiated_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 2. Add unique index on payment_transactions.transaction_id
--    Required for the ON CONFLICT (transaction_id) DO NOTHING clause in
--    mark_order_paid. Partial index excludes NULLs (COD orders may have no
--    transaction_id).
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id
  ON public.payment_transactions (transaction_id)
  WHERE transaction_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Create mark_order_paid() — the ONLY authorized path to paid state.
--
--    SECURITY DEFINER: executes as the function owner (postgres), so
--    current_user inside the trigger evaluates to a privileged role and the
--    trigger allows the write.
--
--    Idempotency: if the order is already paid, the function returns TRUE
--    without error. A second call with the same razorpay_payment_id is a
--    no-op (ON CONFLICT DO NOTHING on the transaction row).
--
--    Parameters:
--      p_order_id           — UUID of the individual order (single-seller)
--      p_master_order_id    — UUID of the master order (multi-seller); when
--                             provided, updates the master row AND all child
--                             orders
--      p_razorpay_payment_id — the Razorpay payment ID (used as transaction_id)
--      p_amount             — captured amount
--
--    Exactly one of p_order_id or p_master_order_id must be non-NULL.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id UUID DEFAULT NULL,
  p_master_order_id UUID DEFAULT NULL,
  p_razorpay_payment_id TEXT DEFAULT NULL,
  p_amount DECIMAL DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected_order_id UUID;
BEGIN
  -- Validate: exactly one of order_id or master_order_id must be provided
  IF (p_order_id IS NULL AND p_master_order_id IS NULL) THEN
    RAISE EXCEPTION 'Either p_order_id or p_master_order_id must be provided'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF (p_order_id IS NOT NULL AND p_master_order_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Only one of p_order_id or p_master_order_id should be provided'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- -------------------------------------------------------------------------
  -- CASE 1: Single-seller order (p_order_id provided)
  -- -------------------------------------------------------------------------
  IF p_order_id IS NOT NULL THEN
    -- Update the order: set paid, clear payment_initiated_at, bump updated_at.
    -- If already paid, this is a no-op (WHERE clause excludes it), which is fine.
    UPDATE public.orders
    SET
      payment_status = 'paid',
      payment_initiated_at = NULL,
      updated_at = NOW()
    WHERE id = p_order_id
      AND payment_status != 'paid';

    -- Record the effective order_id for the transaction insert
    v_affected_order_id := p_order_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- CASE 2: Multi-seller order (p_master_order_id provided)
  --   Update the master_orders row AND all child orders rows.
  -- -------------------------------------------------------------------------
  IF p_master_order_id IS NOT NULL THEN
    -- Update master order
    UPDATE public.master_orders
    SET
      payment_status = 'paid',
      payment_initiated_at = NULL,
      updated_at = NOW()
    WHERE id = p_master_order_id
      AND payment_status != 'paid';

    -- Update all child orders under this master order
    UPDATE public.orders
    SET
      payment_status = 'paid',
      payment_initiated_at = NULL,
      updated_at = NOW()
    WHERE master_order_id = p_master_order_id
      AND payment_status != 'paid';
  END IF;

  -- -------------------------------------------------------------------------
  -- Insert payment_transactions row (idempotent via ON CONFLICT DO NOTHING)
  -- -------------------------------------------------------------------------
  IF p_razorpay_payment_id IS NOT NULL THEN
    INSERT INTO public.payment_transactions (
      id,
      order_id,
      amount,
      status,
      transaction_id,
      payment_method,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      COALESCE(p_order_id, p_master_order_id),
      COALESCE(p_amount, 0),
      'completed',
      p_razorpay_payment_id,
      'razorpay',
      NOW(),
      NOW()
    )
    ON CONFLICT (transaction_id) WHERE transaction_id IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Restrict access to mark_order_paid: only service_role may call it.
--    This ensures the edge function (which uses service_role) is the only
--    path to paid state.
-- -----------------------------------------------------------------------------

ALTER FUNCTION public.mark_order_paid(UUID, UUID, TEXT, DECIMAL) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.mark_order_paid(UUID, UUID, TEXT, DECIMAL)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, UUID, TEXT, DECIMAL)
  TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Create the enforcement trigger function.
--
--    Rules:
--      INSERT: non-privileged callers may only set payment_status = 'pending'
--              (or leave it NULL, which defaults to 'pending').
--      UPDATE: non-privileged callers may NOT change payment_status at all.
--              They CAN update any other column freely (seller status updates,
--              delivery updates, etc.).
--
--    Privileged callers: postgres, supabase_admin, service_role
--    (mark_order_paid runs as SECURITY DEFINER owned by postgres, so it passes)
--
--    On violation: RAISE with ERRCODE = 'insufficient_privilege' so callers
--    get a clear, distinguishable error.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_payment_status_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Privileged callers bypass all checks
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- INSERT: only 'pending' (or NULL which defaults to 'pending') is allowed
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_status IS NOT NULL AND NEW.payment_status != 'pending' THEN
      RAISE EXCEPTION 'Only privileged callers may set payment_status to ''%''. Use the server verification flow.',
        NEW.payment_status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: reject any change to payment_status from a non-privileged caller
  IF TG_OP = 'UPDATE' THEN
    -- Allow updates that don't touch payment_status
    IF OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
      RETURN NEW;
    END IF;

    -- payment_status is being changed by a non-privileged caller → reject
    RAISE EXCEPTION 'Only privileged callers may change payment_status (attempted: ''%'' → ''%''). Use the server verification flow.',
      OLD.payment_status, NEW.payment_status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Attach the trigger to both orders and master_orders.
--    DROP IF EXISTS first to make the migration re-runnable.
-- -----------------------------------------------------------------------------

-- Orders table trigger
DROP TRIGGER IF EXISTS trg_enforce_payment_status_authority ON public.orders;

CREATE TRIGGER trg_enforce_payment_status_authority
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payment_status_authority();

-- Master orders table trigger
DROP TRIGGER IF EXISTS trg_enforce_payment_status_authority ON public.master_orders;

CREATE TRIGGER trg_enforce_payment_status_authority
  BEFORE INSERT OR UPDATE ON public.master_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payment_status_authority();

-- -----------------------------------------------------------------------------
-- 7. Add helpful comments
-- -----------------------------------------------------------------------------

COMMENT ON FUNCTION public.mark_order_paid IS
  'The ONLY authorized path to set payment_status = ''paid''. Called by '
  'verify-razorpay-payment edge function via service_role. Idempotent: '
  'a second call on an already-paid order is a no-op returning TRUE.';

COMMENT ON FUNCTION public.enforce_payment_status_authority IS
  'BEFORE trigger that prevents non-privileged callers from setting '
  'payment_status to anything other than ''pending'' on INSERT, or from '
  'changing payment_status at all on UPDATE. Privileged = postgres, '
  'supabase_admin, service_role.';

COMMENT ON COLUMN public.orders.payment_initiated_at IS
  'Set when an online payment flow begins; cleared by mark_order_paid on '
  'success. Used by the cleanup job to identify stale in-flight orders.';

COMMENT ON COLUMN public.master_orders.payment_initiated_at IS
  'Set when an online payment flow begins; cleared by mark_order_paid on '
  'success. Used by the cleanup job to identify stale in-flight orders.';

-- =============================================================================
-- Done. No SELECT policies were added, altered or dropped.
-- =============================================================================
