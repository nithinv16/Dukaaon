# Razorpay Troubleshooting Guide

## Common Error: "Something went wrong" in Razorpay Popup

This error typically occurs due to one of the following issues:

### 1. Incomplete or Invalid Razorpay Key ID

**Symptom**: Razorpay popup shows "Something went wrong" immediately

**Check**:
- Your Razorpay Key ID should be complete (e.g., `rzp_live_RxirgNtNjhxqSg`)
- It should start with `rzp_live_` (for production) or `rzp_test_` (for testing)
- Minimum length should be 14+ characters

**Fix**:
1. Check your `.env` file or `app.config.js`:
   ```bash
   EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_YOUR_COMPLETE_KEY_ID
   ```

2. Get your complete Key ID from Razorpay Dashboard:
   - Go to https://dashboard.razorpay.com
   - Navigate to **Settings** → **API Keys**
   - Copy the complete Key ID (not just `rzp_live_R`)

3. Update your configuration:
   - Update `.env` file (if using)
   - Update `app.config.js` (fallback value)
   - Restart your app/development server

### 2. Edge Function Not Deployed or Not Working

**Symptom**: Error logs show "Edge Function returned a non-2xx status code" or "404"

**Check**:
- Is the `razorpay-function` deployed?
- Are Razorpay secrets set in Supabase?

**Fix**:
```bash
# Deploy the function
supabase functions deploy razorpay-function

# Set secrets
supabase secrets set RAZORPAY_KEY_ID=rzp_live_YOUR_KEY_ID
supabase secrets set RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
```

### 3. Invalid Amount

**Symptom**: Error when opening checkout

**Check**:
- Amount must be at least ₹1.00 (100 paise)
- Amount should be a valid number

**Fix**: Ensure amount is valid and >= 1.00

### 4. Network Issues

**Symptom**: Intermittent failures

**Check**:
- Internet connection
- Razorpay API status

**Fix**: Check network connectivity and try again

### 5. App Not Approved in Razorpay Dashboard

**Symptom**: Authorization errors

**Check**:
- Is your app package name (`com.sixn8.dukaaon`) approved in Razorpay?
- Is the Play Store link correct?

**Fix**:
1. Go to Razorpay Dashboard → **Settings** → **Apps**
2. Verify your app is listed and approved
3. Check the package name matches: `com.sixn8.dukaaon`
4. Verify Play Store link: `https://play.google.com/store/apps/details?id=com.sixn8.dukaaon`

## Debugging Steps

### 1. Check Console Logs

Look for these log messages:
- `[RazorpayService] Creating Razorpay order via Edge Function...`
- `[RazorpayService] Created Razorpay order: order_xxxxx`
- `[RazorpayService] Opening Razorpay checkout...`
- `[RazorpayService] Razorpay checkout error:`

### 2. Verify Configuration

Run this in your app console:
```javascript
import { razorpayConfig } from './config/razorpay';
console.log('Key ID:', razorpayConfig.keyId);
console.log('Key ID Length:', razorpayConfig.keyId.length);
console.log('Is Valid:', razorpayConfig.keyId.startsWith('rzp_') && razorpayConfig.keyId.length >= 14);
```

### 3. Test Edge Function Directly

```bash
curl -X POST 'https://YOUR_SUPABASE_URL/functions/v1/razorpay-function' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 100,
    "currency": "INR",
    "receipt": "test-123"
  }'
```

### 4. Check Razorpay Dashboard

1. Go to https://dashboard.razorpay.com
2. Check **Payments** → **Orders** for any created orders
3. Check **Settings** → **API Keys** for key status
4. Check **Settings** → **Apps** for app approval status

## Error Code Reference

- `BAD_REQUEST_ERROR`: Invalid request parameters (check amount, key ID, etc.)
- `AUTHORIZATION_ERROR`: Invalid Key ID or Key Secret
- `NETWORK_ERROR`: Network connectivity issue
- `SERVER_ERROR`: Razorpay server issue (try again later)
- `payment_cancelled`: User cancelled the payment (not an error)

## Quick Checklist

- [ ] Razorpay Key ID is complete (14+ characters)
- [ ] Key ID starts with `rzp_live_` or `rzp_test_`
- [ ] Edge Function is deployed (`razorpay-function`)
- [ ] Razorpay secrets are set in Supabase
- [ ] App is approved in Razorpay Dashboard
- [ ] Package name matches: `com.sixn8.dukaaon`
- [ ] Amount is valid (>= ₹1.00)
- [ ] Network connection is stable

## Still Having Issues?

1. Check the full error logs in your console
2. Verify all configuration values
3. Test with a minimal amount (₹1)
4. Contact Razorpay support if the issue persists

