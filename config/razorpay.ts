import { razorpayConfig as razorpaySecrets } from './secrets';

/**
 * Razorpay client configuration.
 *
 * The key **id** is publishable and is all the React Native SDK needs to open
 * the checkout sheet. The key **secret** is never present in the client: it
 * lives in Supabase Edge Function secrets and is used only by the
 * `razorpay-function` (order creation) and `verify-razorpay-payment`
 * (HMAC verification) edge functions.
 *
 * Resolution is delegated to `config/secrets.ts` so there is one place that
 * knows how build-time values reach the bundle. The previous local
 * `getConfigValue` helper did a dynamic `process.env[key]` lookup, which never
 * resolves in a release build — `process.env` is populated with nothing but
 * `NODE_ENV` at runtime — so the value it returned always came from the
 * hardcoded default argument.
 */

const keyId = razorpaySecrets.keyId;

if (__DEV__) {
  console.log(
    '[RazorpayConfig] Key ID:',
    keyId ? `${keyId.substring(0, 15)}… (length: ${keyId.length})` : 'NOT SET'
  );
}

export const razorpayConfig = {
  keyId,
  merchantName: 'DukaaOn',
  merchantDescription: 'B2B Marketplace for Retailers',
  // App package name for deep linking
  appPackageName: 'com.sixn8.dukaaon',
};

/**
 * Validate the client-side Razorpay configuration.
 *
 * Deliberately requires only `keyId` — the SDK does not need the secret, and
 * requiring one here would be a bug, not extra safety.
 */
export const validateRazorpayConfig = (): { isValid: boolean; missingKeys: string[] } => {
  const missingKeys: string[] = [];

  if (!razorpayConfig.keyId) {
    missingKeys.push('EXPO_PUBLIC_RAZORPAY_KEY_ID');
  }

  return {
    isValid: missingKeys.length === 0,
    missingKeys,
  };
};

export default razorpayConfig;
