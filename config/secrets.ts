import Constants from 'expo-constants';

/**
 * Client configuration.
 *
 * ## Why every read in this file is a *static* `process.env.X` access
 *
 * `babel-preset-expo` inlines `process.env.EXPO_PUBLIC_*` as string literals at
 * build time, and it only does this for **statically analysable** member access.
 * At runtime the bundle sets up `process.env = process.env || {}` and populates
 * nothing but `NODE_ENV`, so a *dynamic* lookup like `process.env[key]` always
 * returns `undefined` in a release build.
 *
 * The previous `getConfigValue(key)` helper did exactly that dynamic lookup,
 * which meant it never read an environment variable at all — every value it
 * appeared to return actually came from `Constants.expoConfig.extra[key]` or
 * from a hardcoded default argument. That is how a missing `SUPABASE_URL`
 * silently became `''` and then crashed `services/supabase/supabase.ts` at
 * import time with `Cannot read properties of undefined (reading 'split')`,
 * while looking for all the world like it was configured.
 *
 * Rules for this file:
 *   1. Only ever use static `process.env.EXPO_PUBLIC_...` access.
 *   2. Non-prefixed variables (`SUPABASE_URL`, `FIREBASE_API_KEY`, ...) exist
 *      only while `app.config.js` runs on the build machine. They are NOT
 *      available to the app. Do not read them here.
 *   3. Never add a hardcoded credential as a fallback. A missing value must be
 *      reported, not quietly replaced by something that happens to work.
 *
 * ## Why this module does not throw
 *
 * Missing configuration is caught at **build time** by the guard in
 * `app.config.js`, which is the only place where failing hard is actually
 * useful. Throwing here instead would run at module scope, before React mounts
 * — so it would produce a blank screen with no ErrorBoundary and no Sentry
 * event, which is strictly harder to diagnose than the bug it replaced.
 * Instead we record the problem in `supabaseConfigError` and let the app
 * surface it (see `app/_layout.tsx`).
 *
 * Only publishable values belong here. Anything secret (AWS credentials, the
 * Razorpay key secret, WhatsApp tokens) must live in Supabase Edge Function
 * secrets and be reached through a server-side proxy — a value shipped in the
 * bundle is public by definition.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

/** Read a bundle-inlined value, falling back to a republished `extra` key. */
const fromEnvOrExtra = (inlined: string | undefined, extraKey: string): string => {
  if (inlined) return inlined;
  const republished = extra[extraKey];
  return typeof republished === 'string' ? republished : '';
};

// ---------------------------------------------------------------------------
// Supabase — publishable values (the project URL and anon key are safe in a
// client; RLS is what protects the data).
// ---------------------------------------------------------------------------

const supabaseUrl = fromEnvOrExtra(process.env.EXPO_PUBLIC_SUPABASE_URL, 'supabaseUrl');
const supabaseAnonKey = fromEnvOrExtra(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, 'supabaseAnonKey');

/** `abcdefghijklmnop` from `https://abcdefghijklmnop.supabase.co`, or `''`. */
const parseProjectRef = (url: string): string => {
  // Regex rather than `new URL()`: React Native's built-in URL is incomplete and
  // does not reliably expose `hostname` unless react-native-url-polyfill has
  // already been installed. This module is imported by the Supabase client
  // itself, so it must not depend on load order.
  const match = /^https?:\/\/([^./:]+)/.exec(url);
  return match ? match[1] : '';
};

const projectRef = parseProjectRef(supabaseUrl);

const MISCONFIGURED_HINT =
  'Only EXPO_PUBLIC_* variables reach the app bundle — a non-prefixed variable ' +
  'in .env is visible to app.config.js but NOT to the running app.';

/**
 * Non-null when the Supabase client cannot possibly work, so callers can show a
 * real message instead of failing somewhere unrelated.
 */
export const supabaseConfigError: string | null = (() => {
  if (!supabaseUrl) {
    return `EXPO_PUBLIC_SUPABASE_URL is not configured. ${MISCONFIGURED_HINT}`;
  }
  if (!projectRef) {
    return `EXPO_PUBLIC_SUPABASE_URL is not a valid Supabase URL ("${supabaseUrl}"). Expected https://<project-ref>.supabase.co`;
  }
  if (!supabaseAnonKey) {
    return `EXPO_PUBLIC_SUPABASE_ANON_KEY is not configured. ${MISCONFIGURED_HINT}`;
  }
  return null;
})();

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};

/**
 * The AsyncStorage key supabase-js uses to persist the session.
 *
 * Derived once, here. This previously appeared as an inline
 * `` `sb-${supabaseConfig.url.split('//')[1].split('.')[0]}-auth-token` `` in 11
 * modules — every one of which threw if the URL were ever empty — plus three
 * copies with the project ref hardcoded, which silently break whenever the
 * Supabase project changes. Import this constant instead of re-deriving it.
 *
 * Falls back to a clearly-invalid sentinel rather than throwing, so a
 * misconfigured build reports `supabaseConfigError` instead of dying at import.
 */
export const supabaseAuthStorageKey = projectRef
  ? `sb-${projectRef}-auth-token`
  : 'sb-unconfigured-auth-token';

// ---------------------------------------------------------------------------
// Razorpay — key id only. The key secret lives in Supabase Edge Function
// secrets and is used exclusively by the razorpay-function (order creation) and
// verify-razorpay-payment (HMAC verification) edge functions.
// ---------------------------------------------------------------------------

export const razorpayConfig = {
  keyId: fromEnvOrExtra(process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID, 'EXPO_PUBLIC_RAZORPAY_KEY_ID'),
};

// ---------------------------------------------------------------------------
// Google Maps — necessarily present in the client, so restrict the key by
// Android package name and iOS bundle id in the Google Cloud console. Platform
// restrictions are the only thing limiting its use.
// ---------------------------------------------------------------------------

export const googleMapsConfig = {
  apiKey: fromEnvOrExtra(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, 'googleMapsApiKey'),
};

// Note: the former `firebaseConfig` export was removed. React Native Firebase
// initialises from google-services.json / GoogleService-Info.plist, nothing in
// the app ever imported it, and it read non-prefixed FIREBASE_* variables that
// resolved to empty strings regardless.

export default {
  supabase: supabaseConfig,
  razorpay: razorpayConfig,
  googleMaps: googleMapsConfig,
};
