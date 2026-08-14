-- AI proxy rate limiting
--
-- The ai-translate / ai-ocr / ai-chat edge functions forward requests to paid AWS
-- APIs (Translate, Textract, Bedrock). Authentication alone does not bound spend:
-- one authenticated account could otherwise issue unlimited requests. This adds a
-- per-user, per-function fixed-window quota that the proxies consume atomically.
--
-- Design notes:
--  * Check-and-increment happens inside one UPDATE ... RETURNING so concurrent
--    invocations cannot both observe "under quota". Doing this as a SELECT then an
--    UPDATE in the edge function would race.
--  * The table is service-role only. Clients must never read or write it, and no
--    RLS policy grants them access — the proxies reach it with the service role.
--  * Windows are fixed rather than sliding. A sliding window needs per-request
--    history; for spend control a fixed window is sufficient and far cheaper.

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
    user_id       UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    function_name TEXT        NOT NULL,
    window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed      INTEGER     NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, function_name)
);

COMMENT ON TABLE public.ai_rate_limits IS
    'Per-user fixed-window quota ledger for the AI proxy edge functions. Service-role only.';

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies are created deliberately: with RLS enabled and no policy, anon and
-- authenticated are denied outright. service_role bypasses RLS.
REVOKE ALL ON TABLE public.ai_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_rate_limits TO service_role;

-- Quota configuration, kept in SQL so limits can be tuned by migration rather
-- than by redeploying functions.
CREATE OR REPLACE FUNCTION public.ai_rate_limit_config(p_function TEXT)
RETURNS TABLE (max_requests INTEGER, window_seconds INTEGER)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT *
    FROM (
        VALUES
            -- Translation is called on nearly every screen and is heavily cached
            -- client-side, so the ceiling is generous but still bounded.
            ('ai-translate', 600, 3600),
            -- OCR is user-initiated per photo and costs materially more per call.
            ('ai-ocr',        60, 3600),
            -- Bedrock conversation turns are the most expensive per call.
            ('ai-chat',      120, 3600),
            -- Order notifications: one call per placed order. A tight ceiling also
            -- bounds how much outbound WhatsApp a compromised account can trigger.
            ('notify-order-whatsapp', 60, 3600)
    ) AS cfg(function_name, max_requests, window_seconds)
    WHERE cfg.function_name = p_function

    UNION ALL

    -- Unknown function names get a deliberately tight default rather than
    -- unlimited access, so adding a proxy without adding config fails safe.
    SELECT 30, 3600
    WHERE NOT EXISTS (
        SELECT 1
        FROM (
            VALUES ('ai-translate'), ('ai-ocr'), ('ai-chat'), ('notify-order-whatsapp')
        ) AS known(function_name)
        WHERE known.function_name = p_function
    )

    LIMIT 1;
$$;

-- Atomically consume quota. Returns:
--   { allowed: boolean, remaining: int, retry_after_seconds: int }
CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(
    p_user_id  UUID,
    p_function  TEXT,
    p_cost      INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max            INTEGER;
    v_window_seconds INTEGER;
    v_window_start   TIMESTAMPTZ;
    v_consumed       INTEGER;
BEGIN
    IF p_user_id IS NULL OR p_function IS NULL THEN
        RAISE EXCEPTION 'p_user_id and p_function are required'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_cost < 1 THEN
        p_cost := 1;
    END IF;

    SELECT max_requests, window_seconds
      INTO v_max, v_window_seconds
      FROM public.ai_rate_limit_config(p_function);

    -- Single statement: insert the row, or roll the window / add to the counter.
    -- ON CONFLICT makes this safe under concurrency without an advisory lock.
    INSERT INTO public.ai_rate_limits AS rl (user_id, function_name, window_start, consumed, updated_at)
    VALUES (p_user_id, p_function, NOW(), p_cost, NOW())
    ON CONFLICT (user_id, function_name) DO UPDATE
        SET consumed = CASE
                           WHEN rl.window_start < NOW() - MAKE_INTERVAL(secs => v_window_seconds)
                           THEN p_cost                    -- window expired, restart
                           ELSE rl.consumed + p_cost
                       END,
            window_start = CASE
                               WHEN rl.window_start < NOW() - MAKE_INTERVAL(secs => v_window_seconds)
                               THEN NOW()
                               ELSE rl.window_start
                           END,
            updated_at = NOW()
    RETURNING rl.consumed, rl.window_start INTO v_consumed, v_window_start;

    IF v_consumed > v_max THEN
        RETURN JSONB_BUILD_OBJECT(
            'allowed', FALSE,
            'remaining', 0,
            'retry_after_seconds',
            GREATEST(
                1,
                CEIL(EXTRACT(EPOCH FROM (v_window_start + MAKE_INTERVAL(secs => v_window_seconds) - NOW())))::INTEGER
            )
        );
    END IF;

    RETURN JSONB_BUILD_OBJECT(
        'allowed', TRUE,
        'remaining', v_max - v_consumed,
        'retry_after_seconds', 0
    );
END;
$$;

-- Only the proxies (service_role) may consume quota. A client that could call
-- this directly could drain its own allowance or, worse, another user's.
REVOKE ALL ON FUNCTION public.consume_ai_rate_limit(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(UUID, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.ai_rate_limit_config(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_rate_limit_config(TEXT) TO service_role;

-- Housekeeping: drop windows nobody has touched in a day.
CREATE OR REPLACE FUNCTION public.cleanup_ai_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.ai_rate_limits
     WHERE updated_at < NOW() - INTERVAL '1 day';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_ai_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_ai_rate_limits() TO service_role;
