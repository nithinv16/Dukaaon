-- ===========================================================================
-- Bug-condition exploration probe — cleanup job safety
--
-- Spec: .kiro/specs/critical-security-and-error-fixes (task 5)
-- Property 4: Bug Condition — Cleanup Never Deletes an In-Flight or Paid Order
-- Validates: Requirements 1.20, 2.5, 3.6
--
-- GOAL: run the real `cleanup_pending_orders()` against seeded rows and record
-- which survived. The model half of this probe — which extracts the predicate
-- from the committed migration and evaluates it as a property test — lives in
-- tests/payments/cleanupPendingOrders.bugCondition.property.test.ts and needs no
-- database. This script is for operators with direct database access, and is the
-- only half that can detect migration drift between the committed predicate and
-- the one actually applied.
--
-- EXPECTED OUTCOME ON THE UNFIXED SCHEMA:
--   PROBE 1 reports FAILED — an in-flight online order 6 minutes old, with
--           `status = 'pending'`, is DELETED. Clause 3.6 forbids exactly this.
--   PROBE 3 reports FAILED — an abandoned online order 20 minutes old with
--           `status = 'placed'` (the value checkout actually writes) SURVIVES,
--           and will survive every future run, so abandoned orders accumulate.
--   PROBE 6 reports FAILED — the interleaving case, for the same reason as 1.
--   PROBES 2, 4 and 5 report OK. They are the preserved baseline: a paid order
--           and a COD order are already safe, and must stay safe after task 12.1.
--
-- After task 12.1 lands, every probe must report OK. That is the task 12.2
-- verification.
--
-- ---------------------------------------------------------------------------
-- !! DO NOT RUN THIS AGAINST PRODUCTION !!
-- `cleanup_pending_orders()` DELETES rows, and it deletes every row matching its
-- predicate, not only the ones seeded here. Everything below runs inside a
-- single transaction that ends in ROLLBACK, so a clean run leaves the database
-- as it was — including any non-probe row the function deleted. That safety net
-- depends on the ROLLBACK actually being reached: do not run this with
-- `--single-transaction` disabled expectations, and do not COMMIT it.
-- Local (`supabase start`) or a throwaway branch database only.
-- ---------------------------------------------------------------------------
--
-- HOW TO RUN
--   psql "<local-or-branch-db-url>" -v ON_ERROR_STOP=0 \
--     -f supabase/probes/cleanup_pending_orders_probe.sql
--
-- HOW TO READ THE OUTPUT
--   Each probe prints one row: 'PROBE n OK — ...' or 'PROBE n FAILED — ...'.
--   FAILED on the unfixed schema is the finding, not a malfunction.
-- ===========================================================================

\set ON_ERROR_STOP 0
\timing off

\echo ''
\echo '=== cleanup_pending_orders() safety probe ==='
SELECT current_database() AS db, current_user AS role, inet_server_addr() AS server_addr;

-- ---------------------------------------------------------------------------
-- What is actually installed? This is the drift check the model half cannot do.
-- ---------------------------------------------------------------------------
\echo ''
\echo '--- The predicate as the running database has it (compare with the committed migration):'
SELECT p.proname, pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'cleanup_pending_orders';

\echo ''
\echo '--- Is the job actually scheduled, and how often? (task 13.1 confirms this too)'
SELECT jobid, schedule, command, active
  FROM cron.job
 WHERE jobname = 'cleanup-pending-orders';

\echo ''
\echo '--- Does orders.payment_initiated_at exist yet? (added by task 11.1)'
SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders'
            AND column_name = 'payment_initiated_at'
       ) AS payment_initiated_at_present;

-- ===========================================================================
-- Seed, run cleanup once, and report. One transaction, rolled back at the end.
-- ===========================================================================
BEGIN;

\set probe_user '''44444444-4444-4444-8444-444444444444'''

INSERT INTO auth.users (id, email, aud, role)
VALUES (:probe_user, 'cleanup-probe@example.invalid', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, phone_number, role)
VALUES (:probe_user, '+910000000002', 'retailer')
ON CONFLICT (id) DO NOTHING;

-- Six rows covering both directions of the predicate.
--
-- `payment_method` values are the ones the app really stores, not the ones the
-- task description names: `mapPaymentMethod` in app/(main)/checkout/index.tsx
-- folds 'razorpay' | 'card' | 'netbanking' -> 'online' and 'cod' -> 'cash'
-- before the insert, so no order from checkout ever carries 'razorpay'.
INSERT INTO public.orders
  (order_number, seller_id, user_id, total_amount, payment_method, payment_status, status, created_at)
VALUES
  -- 1. In-flight, 6 minutes old, old flow's status value. MUST SURVIVE.
  ('CLEANUP-PROBE-1', :probe_user, :probe_user, 100, 'online', 'pending', 'pending',
   NOW() - INTERVAL '6 minutes'),
  -- 2. In-flight, 6 minutes old, the status checkout actually writes. MUST SURVIVE.
  ('CLEANUP-PROBE-2', :probe_user, :probe_user, 100, 'online', 'pending', 'placed',
   NOW() - INTERVAL '6 minutes'),
  -- 3. Abandoned past the 15-minute grace window. MUST BE DELETED.
  ('CLEANUP-PROBE-3', :probe_user, :probe_user, 100, 'online', 'pending', 'placed',
   NOW() - INTERVAL '20 minutes'),
  -- 4. Paid. MUST SURVIVE. Preserved baseline.
  ('CLEANUP-PROBE-4', :probe_user, :probe_user, 100, 'online', 'paid', 'placed',
   NOW() - INTERVAL '90 minutes'),
  -- 5. COD, stored as 'cash'. MUST SURVIVE. Preserved baseline.
  ('CLEANUP-PROBE-5', :probe_user, :probe_user, 100, 'cash', 'pending', 'placed',
   NOW() - INTERVAL '90 minutes'),
  -- 6. In-flight, about to be marked paid. MUST SURVIVE, so the paid write lands.
  ('CLEANUP-PROBE-6', :probe_user, :probe_user, 100, 'online', 'pending', 'pending',
   NOW() - INTERVAL '6 minutes');

-- Set the in-flight marker when the column exists, so the same script exercises
-- the fixed predicate as well as the unfixed one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'orders'
                AND column_name = 'payment_initiated_at') THEN
    EXECUTE $q$
      UPDATE public.orders
         SET payment_initiated_at = created_at
       WHERE order_number IN ('CLEANUP-PROBE-1','CLEANUP-PROBE-2','CLEANUP-PROBE-3','CLEANUP-PROBE-6')
    $q$;
    RAISE NOTICE 'payment_initiated_at set on the online probe rows';
  ELSE
    RAISE NOTICE 'payment_initiated_at absent — probing the pre-task-11.1 schema';
  END IF;
END $$;

\echo ''
\echo '--- Running cleanup_pending_orders() ...'
SELECT * FROM cleanup_pending_orders();

\echo ''
\echo '--- Verdicts'
SELECT 'PROBE 1 ' ||
       CASE WHEN EXISTS (SELECT 1 FROM public.orders WHERE order_number = 'CLEANUP-PROBE-1')
            THEN 'OK — in-flight online order (status pending, 6 min) survived.'
            ELSE 'FAILED — in-flight online order (status pending, 6 min) was DELETED. '
              || 'A legitimate slow payment can be destroyed between callback and '
              || 'verification. Clause 3.6 forbids this.'
       END AS verdict
UNION ALL
SELECT 'PROBE 2 ' ||
       CASE WHEN EXISTS (SELECT 1 FROM public.orders WHERE order_number = 'CLEANUP-PROBE-2')
            THEN 'OK — in-flight online order (status placed, 6 min) survived.'
            ELSE 'FAILED — in-flight online order (status placed, 6 min) was DELETED.'
       END
UNION ALL
SELECT 'PROBE 3 ' ||
       CASE WHEN EXISTS (SELECT 1 FROM public.orders WHERE order_number = 'CLEANUP-PROBE-3')
            THEN 'FAILED — abandoned online order (status placed, 20 min) SURVIVED. '
              || 'It will survive every future run too, because the predicate requires '
              || 'status = ''pending'' and checkout writes ''placed''. Abandoned orders accumulate.'
            ELSE 'OK — abandoned online order past the grace window was reclaimed.'
       END
UNION ALL
SELECT 'PROBE 4 ' ||
       CASE WHEN EXISTS (SELECT 1 FROM public.orders WHERE order_number = 'CLEANUP-PROBE-4')
            THEN 'OK — paid order survived (preserved baseline).'
            ELSE 'FAILED — a PAID order was deleted. This is a money-losing regression.'
       END
UNION ALL
SELECT 'PROBE 5 ' ||
       CASE WHEN EXISTS (SELECT 1 FROM public.orders WHERE order_number = 'CLEANUP-PROBE-5')
            THEN 'OK — COD order survived (preserved baseline).'
            ELSE 'FAILED — a COD order was deleted.'
       END;

-- ---------------------------------------------------------------------------
-- Interleaving: cleanup has already run. Can the paid transition still land?
-- This is the ordering that matters — the other one (paid first, then cleanup)
-- is covered by PROBE 4.
-- ---------------------------------------------------------------------------
\echo ''
\echo '--- PROBE 6: interleaving — the paid transition arrives after a cleanup run'

UPDATE public.orders
   SET payment_status = 'paid'
 WHERE order_number = 'CLEANUP-PROBE-6';

SELECT 'PROBE 6 ' ||
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = 'CLEANUP-PROBE-6')
            THEN 'FAILED — the row was deleted by cleanup before the paid transition '
              || 'could land, so a captured payment has no order. No ordering of the two '
              || 'operations can recover it.'
            WHEN (SELECT payment_status FROM public.orders WHERE order_number = 'CLEANUP-PROBE-6') = 'paid'
            THEN 'OK — the row survived cleanup and the paid transition landed.'
            ELSE 'FAILED — the row survived but is not paid.'
       END AS verdict;

-- Second cleanup run, now that the row is paid: it must be left alone.
SELECT * FROM cleanup_pending_orders();

SELECT 'PROBE 6b ' ||
       CASE WHEN EXISTS (SELECT 1 FROM public.orders
                          WHERE order_number = 'CLEANUP-PROBE-6' AND payment_status = 'paid')
            THEN 'OK — a second cleanup run left the now-paid order alone.'
            ELSE 'FAILED — cleanup deleted an order that was already paid.'
       END AS verdict;

-- Undoes the seeded rows AND any non-probe row the cleanup runs above deleted.
ROLLBACK;

\echo ''
\echo '=== probe complete, transaction rolled back.'
\echo '=== Record the verdicts in docs/PHASE1_CLEANUP_JOB_SAFETY.md'
