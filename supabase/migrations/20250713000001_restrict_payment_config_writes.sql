-- Restrict payment_config writes to service_role
--
-- Context: payment_config holds the platform's own UPI id and bank account — the
-- destination for money. update_payment_config was granted to `authenticated`,
-- with authorization expressed as:
--
--     is_admin := COALESCE(auth.jwt() ->> 'role', '') = 'admin';
--
-- That claim can never equal 'admin' in this project. The top-level `role` claim
-- in a Supabase JWT is the Postgres role — 'authenticated' for a signed-in user,
-- 'anon' otherwise. Injecting a custom value requires the custom access token
-- hook, which is `enabled = false` in supabase/config.toml, and whose hook
-- function exists only in loose sql/ scratch files, never in an applied
-- migration.
--
-- So the guard has always rejected every caller, and the accompanying RLS policy
-- (also `auth.jwt() ->> 'role' = 'admin'`) has always evaluated false. The
-- practical effect: this was dead code rather than an open door. But leaving
-- EXECUTE granted to every authenticated user means the only thing standing
-- between an ordinary account and the payout configuration is a predicate that
-- would start passing the moment someone enables the custom-claims hook for an
-- unrelated reason. That is a latent trapdoor, not a control.
--
-- This migration removes the ambiguity: writes are service_role only, enforced by
-- grants rather than by a claim that is not actually populated. The retailer app
-- no longer contains an admin screen for this — platform payout configuration
-- belongs in an internal tool with a real operator identity.
--
-- Reads are unchanged: app/(main)/payment/methods.tsx calls get_payment_config to
-- render the UPI destination at checkout, so `authenticated` keeps EXECUTE on the
-- read path and SELECT on the table.

-- Writes: service_role only.
REVOKE EXECUTE ON FUNCTION public.update_payment_config(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_config(TEXT, JSONB) TO service_role;

-- Reads: unchanged, stated explicitly so the intent survives future audits.
GRANT EXECUTE ON FUNCTION public.get_payment_config(TEXT) TO authenticated;

-- Replace the unsatisfiable RLS policy with one that says what it means.
-- service_role bypasses RLS, so no policy is needed to permit operator writes;
-- the point here is to stop asserting a control that does not exist.
DROP POLICY IF EXISTS "Allow admin users to manage payment config" ON public.payment_config;

-- The SELECT policy from 20251003103000 ("Allow authenticated users to read
-- payment config") is intentionally left in place — checkout depends on it.

-- Ensure direct table writes are not reachable from the client either. The read
-- grant is left in place for the checkout path.
REVOKE INSERT, UPDATE, DELETE ON public.payment_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_config TO authenticated;

COMMENT ON FUNCTION public.update_payment_config(TEXT, JSONB) IS
    'Service-role only. Platform payout configuration. The historical '
    '"auth.jwt() ->> role = admin" check never passed because that claim holds the '
    'Postgres role and the custom access token hook is disabled; authorization is '
    'now enforced by grants instead.';
