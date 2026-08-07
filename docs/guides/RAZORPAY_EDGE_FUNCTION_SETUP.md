# Razorpay Edge Function Setup Guide

## Overview

This guide explains how to set up the Supabase Edge Function for creating Razorpay orders. This is **required** for Razorpay payments to work properly.

## Why This Is Needed

Razorpay requires creating an order via their API **before** opening the checkout. The order creation must be done server-side using your **Key Secret** (which should never be exposed in client-side code).

## Setup Steps

### 1. Deploy the Edge Function

The Edge Function is already created at:
```
supabase/functions/razorpay-function/
```

To deploy it:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy razorpay-function
```

### 2. Set Environment Variables

You need to set the Razorpay credentials as environment variables in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Add the following secrets:

```
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_complete_key_secret_here
```

**Important**: 
- Use your **complete** Razorpay Key ID (not just `rzp_live_R`)
- Use your **complete** Razorpay Key Secret
- These should match the credentials you provided to Razorpay for app approval

### 3. Verify the Function

After deployment, test the function:

```bash
# Get your Supabase anon key and access token
# Then test with curl:

curl -X POST 'https://your-project.supabase.co/functions/v1/razorpay-function' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 100,
    "currency": "INR",
    "receipt": "test-receipt-123"
  }'
```

You should get a response with `order_id` like:
```json
{
  "success": true,
  "order_id": "order_xxxxxxxxxxxxx",
  "amount": 10000,
  "currency": "INR"
}
```

## How It Works

1. **User initiates payment** → Frontend calls `razorpayService.initializePayment()`
2. **Service creates Razorpay order** → Calls Supabase Edge Function
3. **Edge Function creates order** → Uses Razorpay API with Key Secret
4. **Order ID returned** → Frontend receives Razorpay `order_id`
5. **Checkout opens** → Razorpay checkout uses the `order_id`
6. **Payment completes** → User completes payment in Razorpay UI

## Troubleshooting

### Error: "Razorpay credentials not configured"
- **Solution**: Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Supabase Edge Function secrets

### Error: "Failed to create Razorpay order"
- **Check**: Your Razorpay Key ID and Secret are correct
- **Check**: The keys match the environment (test vs live)
- **Check**: Your Razorpay account is active

### Error: "Unauthorized"
- **Solution**: Make sure the user is logged in and has a valid session

### Function not found
- **Solution**: Deploy the function using `supabase functions deploy razorpay-function`

## Alternative: Without Edge Function (Not Recommended)

If you can't use Edge Functions, you can:
1. Create a separate backend API (Node.js, Python, etc.)
2. Update `razorpayService.ts` to call your backend instead
3. Make sure your backend has the Razorpay Key Secret

## Security Notes

- ✅ **Key Secret is stored server-side** (in Supabase secrets)
- ✅ **Key Secret is never exposed to client**
- ✅ **Authentication required** to create orders
- ✅ **HTTPS enforced** for all API calls

## Next Steps

After setting up the Edge Function:
1. Test with a small amount (₹1)
2. Verify order creation in Razorpay Dashboard
3. Complete a test payment
4. Check payment appears in your database

