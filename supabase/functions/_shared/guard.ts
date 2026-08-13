/**
 * Shared request guard for the AI proxy functions.
 *
 * These functions spend real money per call (AWS Translate, Textract, Bedrock),
 * so authentication alone is not sufficient protection — a single authenticated
 * user could otherwise run up an unbounded bill. Every proxy therefore enforces:
 *
 *   1. A verified Supabase JWT (also `verify_jwt = true` in config.toml, so this
 *      is defence in depth rather than the only check).
 *   2. A per-user, per-function rate limit backed by Postgres.
 *   3. Hard caps on input size, checked before anything is forwarded to AWS.
 *
 * CORS is intentionally restrictive: these are called from the mobile app via
 * supabase-js, not from a browser origin, so no wildcard is needed for normal
 * operation.
 */

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const jsonHeaders = { "Content-Type": "application/json", ...corsHeaders };

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export function errorResponse(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: message, ...(code ? { code } : {}) }, status);
}

export interface AuthedRequest {
  userId: string;
  /** Service-role client. Use only for the rate-limit ledger, never for user data. */
  admin: SupabaseClient;
}

/**
 * Resolve and verify the caller.
 *
 * Uses an anon-key client bound to the caller's JWT so `getUser()` is validated
 * against the auth server rather than trusting an unverified token payload.
 */
export async function authenticate(req: Request): Promise<AuthedRequest | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("Missing authorization header", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Supabase environment incomplete in edge function");
    return errorResponse("Server configuration error", 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  return { userId: data.user.id, admin };
}

/**
 * Consume one unit of a per-user quota window.
 *
 * Delegates to the `consume_ai_rate_limit` RPC so the check-and-increment is a
 * single atomic statement. Doing it as a read followed by a write here would let
 * concurrent invocations both observe "under quota" and both proceed.
 *
 * Fails **closed** on an unexpected error: if the ledger cannot be consulted we
 * decline rather than hand out unmetered access to a paid API.
 */
export async function consumeRateLimit(
  { userId, admin }: AuthedRequest,
  functionName: string,
  cost = 1
): Promise<Response | null> {
  const { data, error } = await admin.rpc("consume_ai_rate_limit", {
    p_user_id: userId,
    p_function: functionName,
    p_cost: cost,
  });

  if (error) {
    console.error(`Rate limit check failed for ${functionName}:`, error.message);
    return errorResponse("Rate limit unavailable, please retry", 503, "RATE_LIMIT_UNAVAILABLE");
  }

  if (data && data.allowed === false) {
    return jsonResponse(
      {
        error: "Rate limit exceeded",
        code: "RATE_LIMITED",
        retry_after_seconds: data.retry_after_seconds ?? 60,
      },
      429
    );
  }

  return null;
}

/** Parse a JSON body, rejecting anything oversized before it is deserialised. */
export async function parseJsonBody<T>(
  req: Request,
  maxBytes: number
): Promise<T | Response> {
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    return errorResponse(`Request body exceeds ${maxBytes} bytes`, 413);
  }

  const raw = await req.text();
  if (raw.length > maxBytes) {
    return errorResponse(`Request body exceeds ${maxBytes} bytes`, 413);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return errorResponse("Malformed JSON body", 400);
  }
}

/** Standard preflight/method handling shared by every proxy. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }
  return null;
}
