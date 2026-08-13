-- ===========================================================================
-- Bug-condition exploration probe — database authority over payment_status
--
-- Spec: .kiro/specs/critical-security-and-error-fixes (task 3)
-- Property 1: Bug Condition — Paid State Requires Server-Verified Signature
--             (database-level half)
-- Validates: Requirements 1.20, 2.20
--
-- GOAL: confirm that no database-level authority exists over `payment_status`,
-- independently of the client code. The client-side half is covered by
-- tests/payments/paymentIntegrity.bugCondition.property.test.tsx (task 2).
--
-- EXPECTED OUTCOME ON THE UNFIXED SCHEMA: every probe below SUCCEEDS in
-- writing `payment_status = 'paid'` under a plain authenticated (user JWT)
-- role, i.e. the probe's assertions FAIL. That failure is the finding. The only
-- existing control is a CHECK constraint on allowed *values*
-- (supabase/migrations/20250105000000_create_orders.sql:26 and
-- supabase/migrations/20250126000004_create_master_orders_system.sql:22); no
-- RLS policy, trigger or security-definer RPC restricts *who* may write which
-- value.
--
-- After task 11.1 lands, the same probe must report REJECTED for all three
-- writes with SQLSTATE 42501 (insufficient_privilege). That is the task 11.5
-- verification.
--
-- ---------------------------------------------------------------------------
-- !! DO NOT RUN THIS AGAINST PRODUCTION !!
-- Run it only against a local instance (`supabase start`, then
-- `psql "$(supabase status -o env | grep DB_URL ...)"`) or an explicitly
-- provisioned branch database. It seeds an auth user, a profile and orders.
-- Everything is wrapped in transactions that ROLLBACK, so nothing is left
-- behind on a clean run, but a seeded probe row is still a write.
-- ---------------------------------------------------------------------------
--
-- HOW TO RUN
--   psql "<local-or-branch-db-url>" -v ON_ERROR_STOP=0 \
--     -f supabase/probes/payment_status_authority_probe.sql
--
-- HOW TO READ THE OUTPUT
--   Each probe prints exactly one of:
--     'PROBE n FAILED — write ACCEPTED ...'  -> bug condition CONFIRMED (unfixed)
--     an ERROR from Postgres before the verdict line, then the transaction
--     aborts -> the write was REJECTED, which is the fixed state. The SQLSTATE
--     in that error is the verdict; look for 42501.
--   'current transaction is aborted' noise after a rejection is expected; the
--   ROLLBACK at the end of each block clears it.
-- ===========================================================================

\set ON_ERROR_STOP 0
\timing off

-- Refuse to run anywhere that looks like a hosted production project unless
-- the operator explicitly opts in. `supabase_admin` exists on hosted projects
-- too, so this is a guard rail, not a wall: read it and mean it.
\echo ''
\echo '=== payment_status authority probe ==='
\echo '=== current database / user / setting: ==='
SELECT current_database() AS db, current_user AS role, inet_server_addr() AS server_addr;

-- Fixed ids so the probe is repeatable and greppable.
\set probe_user '''11111111-1111-4111-8111-111111111111'''
\set probe_order '''22222222-2222-4222-8222-222222222222'''
\set probe_master '''33333333-3333-4333-8333-333333333333'''
\set probe_claims '''{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aud":"authenticated"}'''

-- ===========================================================================
-- PROBE 1 — UPDATE orders SET payment_status = 'paid' as the owning user
-- Design test case 5: "with a normal user JWT, UPDATE orders SET
-- payment_status = 'paid' WHERE user_id = <self>. Assert rejection."
-- ===========================================================================
BEGIN;

\echo ''
\echo '--- PROBE 1: UPDATE orders.payment_status -> paid, as authenticated owner'

-- Seed (as the connection role, i.e. privileged). Not part of the assertion.
INSERT INTO auth.users (id, email, aud, role)
VALUES (:probe_user, 'payment-authority-probe@example.invalid', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, phone_number, role)
VALUES (:probe_user, '+910000000001', 'retailer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.orders (id, order_number, seller_id, user_id, total_amount,
                           payment_method, payment_status, status)
VALUES (:probe_order, 'PROBE-ORDER-1', :probe_user, :probe_user, 100,
        'razorpay', 'pending', 'confirmed')
ON CONFLICT (id) DO UPDATE SET payment_status = 'pending';

-- Become a plain app user. This is what a Supabase anon-key client holding a
-- signed-in user's JWT is: role `authenticated`, with request.jwt.claims set.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO :probe_claims;

UPDATE public.orders
   SET payment_status = 'paid'
 WHERE user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;

-- Reached only if the UPDATE was not rejected.
RESET ROLE;
SELECT CASE
         WHEN payment_status = 'paid'
           THEN 'PROBE 1 FAILED — write ACCEPTED: a user JWT set orders.payment_status = paid. Bug condition CONFIRMED (clause 1.20).'
         ELSE 'PROBE 1 inconclusive — no error raised but payment_status is ' || payment_status
       END AS verdict
  FROM public.orders WHERE id = :probe_order;

ROLLBACK;

-- ===========================================================================
-- PROBE 2 — the same UPDATE on master_orders
-- ===========================================================================
BEGIN;

\echo ''
\echo '--- PROBE 2: UPDATE master_orders.payment_status -> paid, as authenticated owner'

INSERT INTO auth.users (id, email, aud, role)
VALUES (:probe_user, 'payment-authority-probe@example.invalid', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.master_orders (id, order_number, user_id, total_amount, grand_total,
                                  delivery_address, payment_method, payment_status, status)
VALUES (:probe_master, 'PROBE-MASTER-1', :probe_user, 100, 100,
        '{"line1":"probe"}'::jsonb, 'razorpay', 'pending', 'pending')
ON CONFLICT (id) DO UPDATE SET payment_status = 'pending';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO :probe_claims;

UPDATE public.master_orders
   SET payment_status = 'paid'
 WHERE user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;

RESET ROLE;
SELECT CASE
         WHEN payment_status = 'paid'
           THEN 'PROBE 2 FAILED — write ACCEPTED: a user JWT set master_orders.payment_status = paid. Bug condition CONFIRMED (clause 1.20).'
         ELSE 'PROBE 2 inconclusive — no error raised but payment_status is ' || payment_status
       END AS verdict
  FROM public.master_orders WHERE id = :probe_master;

ROLLBACK;

-- ===========================================================================
-- PROBE 3 — INSERT INTO orders with payment_status = 'paid' as a user JWT.
-- This is the shape app/(main)/checkout/index.tsx:321 actually uses today.
-- ===========================================================================
BEGIN;

\echo ''
\echo '--- PROBE 3: INSERT orders with payment_status = paid, as authenticated user'

INSERT INTO auth.users (id, email, aud, role)
VALUES (:probe_user, 'payment-authority-probe@example.invalid', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, phone_number, role)
VALUES (:probe_user, '+910000000001', 'retailer')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO :probe_claims;

INSERT INTO public.orders (order_number, seller_id, user_id, total_amount,
                           payment_method, payment_status, status)
VALUES ('PROBE-ORDER-3', :probe_user, :probe_user, 100,
        'razorpay', 'paid', 'confirmed');

RESET ROLE;
SELECT CASE
         WHEN count(*) > 0
           THEN 'PROBE 3 FAILED — write ACCEPTED: a user JWT inserted an order already at payment_status = paid. Bug condition CONFIRMED (clause 1.20).'
         ELSE 'PROBE 3 inconclusive — no error raised but no row landed'
       END AS verdict
  FROM public.orders
 WHERE order_number = 'PROBE-ORDER-3' AND payment_status = 'paid';

ROLLBACK;

-- ===========================================================================
-- PROBE 4 — positive control. Confirms what the *only* existing control is:
-- a CHECK constraint on allowed VALUES, which says nothing about the actor.
-- This one is expected to report PRESENT both before and after the fix.
-- ===========================================================================
\echo ''
\echo '--- PROBE 4 (positive control): what constrains payment_status today?'

SELECT c.relname            AS table_name,
       con.conname          AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
 WHERE c.relname IN ('orders', 'master_orders')
   AND pg_get_constraintdef(con.oid) ILIKE '%payment_status%'
 ORDER BY c.relname, con.conname;

\echo ''
\echo '--- PROBE 4b: any trigger on orders / master_orders that could gate the value?'
SELECT c.relname AS table_name, t.tgname AS trigger_name, p.proname AS function_name,
       pg_get_functiondef(p.oid) ILIKE '%payment_status%' AS mentions_payment_status
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc  p ON p.oid = t.tgfoid
 WHERE c.relname IN ('orders', 'master_orders')
   AND NOT t.tgisinternal
 ORDER BY c.relname, t.tgname;

\echo ''
\echo '--- PROBE 4c: RLS policies on orders / master_orders — do any mention payment_status?'
SELECT c.relname AS table_name, pol.polname, pol.polcmd,
       pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
 WHERE c.relname IN ('orders', 'master_orders')
 ORDER BY c.relname, pol.polname;

\echo ''
\echo '--- PROBE 4d: is there a security-definer RPC that owns the paid transition?'
SELECT p.proname, p.prosecdef AS security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND pg_get_functiondef(p.oid) ILIKE '%payment_status%'
 ORDER BY p.proname;

\echo ''
\echo '--- PROBE 4e: column-level privileges on payment_status'
SELECT table_name, grantee, privilege_type
  FROM information_schema.column_privileges
 WHERE table_schema = 'public'
   AND table_name IN ('orders', 'master_orders')
   AND column_name = 'payment_status'
 ORDER BY table_name, grantee, privilege_type;

\echo ''
\echo '=== probe complete. Record the verdicts in'
\echo '=== docs/PHASE1_PAYMENT_STATUS_DB_PROBE.md'
