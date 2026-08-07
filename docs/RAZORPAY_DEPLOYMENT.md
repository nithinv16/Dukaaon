# Razorpay Edge Function Deployment Guide

This guide explains how to deploy the Razorpay Edge Function to Supabase and configure it properly.

## Prerequisites

1. Supabase CLI installed and authenticated
2. Razorpay account with API keys (Key ID and Key Secret)
3. Access to your Supabase project

## Step 1: Set Razorpay Secrets in Supabase

The Edge Function requires Razorpay credentials to be set as Supabase secrets.

### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Add the following secrets:
   - `RAZORPAY_KEY_ID`: Your Razorpay Key ID (e.g., `rzp_live_...` or `rzp_test_...`)
   - `RAZORPAY_KEY_SECRET`: Your Razorpay Key Secret

### Option B: Using Supabase CLI

```bash
# Set Razorpay Key ID
supabase secrets set RAZORPAY_KEY_ID=rzp_live_YOUR_KEY_ID

# Set Razorpay Key Secret
supabase secrets set RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
```

**Important**: 
- Use `rzp_live_...` for production (live mode)
- Use `rzp_test_...` for testing (test mode)
- Make sure the Key ID and Key Secret match (both live or both test)

## Step 2: Deploy the Edge Function

### Using Supabase CLI

```bash
# Make sure you're in the project root directory
cd d:\dukaaon

# Deploy the function
supabase functions deploy razorpay-function

# Or deploy all functions
supabase functions deploy
```

### Verify Deployment

After deployment, you should see a success message. You can verify the function is deployed by:

1. Checking Supabase Dashboard → **Edge Functions** → You should see `razorpay-function` listed
2. Testing the function (see Step 3)

## Step 3: Test the Edge Function

### Using Supabase Dashboard

1. Go to **Edge Functions** → `razorpay-function`
2. Click **Invoke Function**
3. Use this test payload:
```json
{
  "amount": 100.00,
  "currency": "INR",
  "receipt": "test_receipt_123",
  "notes": {
    "order_id": "test_order_123"
  }
}
```

### Using cURL

```bash
# Replace YOUR_SUPABASE_URL and YOUR_ANON_KEY with your actual values
# Replace YOUR_ACCESS_TOKEN with a valid user access token

curl -X POST \
  https://YOUR_SUPABASE_URL/functions/v1/razorpay-function \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "currency": "INR",
    "receipt": "test_receipt_123",
    "notes": {
      "order_id": "test_order_123"
    }
  }'
```

### Expected Response

On success, you should receive:
```json
{
  "order_id": "order_xxxxxxxxxxxxx",
  "amount": 10000,
  "currency": "INR",
  "receipt": "test_receipt_123",
  "status": "created"
}
```

## Step 4: Verify in App

After deployment, test the payment flow in your app:

1. Add items to cart
2. Go to checkout
3. Select Razorpay as payment method
4. Complete the payment

The app should now successfully create Razorpay orders via the Edge Function.

## Troubleshooting

### Error: "Edge Function not found" or 404

**Solution**: The function is not deployed. Run:
```bash
supabase functions deploy razorpay-function
```

### Error: "Razorpay credentials not configured" or 500

**Solution**: The secrets are not set. Set them using:
```bash
supabase secrets set RAZORPAY_KEY_ID=your_key_id
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret
```

### Error: "Unauthorized" or 401

**Solution**: The user is not authenticated. Make sure:
- The user is logged in
- The access token is valid
- The Authorization header is being sent correctly

### Error: "Invalid amount" or 400

**Solution**: Check that:
- Amount is greater than 0
- Amount is a valid number
- Receipt is provided

### Error from Razorpay API

If you get an error from Razorpay (e.g., "Invalid key"), check:
- Key ID and Key Secret are correct
- Key ID and Key Secret match (both live or both test)
- The keys are active in your Razorpay dashboard

## Local Development

To test the Edge Function locally:

```bash
# Start Supabase locally
supabase start

# Serve the function locally
supabase functions serve razorpay-function

# Test locally
curl -X POST \
  http://localhost:54321/functions/v1/razorpay-function \
  -H "Authorization: Bearer YOUR_LOCAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "currency": "INR",
    "receipt": "test_receipt_123"
  }'
```

## Security Notes

1. **Never commit secrets to git**: Secrets should only be set via Supabase CLI or dashboard
2. **Use environment-specific keys**: Use test keys for development, live keys for production
3. **Rotate keys regularly**: Update secrets if keys are compromised
4. **Monitor function logs**: Check Supabase dashboard for function execution logs

## Next Steps

After successful deployment:
1. Test the complete payment flow
2. Monitor function logs for any errors
3. Set up alerts for failed payments
4. Consider adding rate limiting if needed

