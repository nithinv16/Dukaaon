# Razorpay Payment Integration Guide

## Overview

This guide explains how Razorpay payment integration is set up in the DukaaOn app. The integration allows users to pay for orders using UPI, cards, netbanking, and other payment methods supported by Razorpay.

## Current Implementation

### Files Created/Modified

1. **`config/razorpay.ts`** - Razorpay configuration with credentials
2. **`services/payment/razorpayService.ts`** - Main Razorpay service implementation
3. **`components/payment/PaymentProcessor.tsx`** - Updated to use Razorpay service
4. **`app.config.js`** - Added Razorpay credentials to Expo config
5. **`config/secrets.ts`** - Added Razorpay config to secrets

### Credentials

The Razorpay credentials are configured as:
- **Key ID**: `rzp_live_R`
- **Key Secret**: `XNC1LWew` (used for backend verification only)

These are stored in:
- Environment variables: `EXPO_PUBLIC_RAZORPAY_KEY_ID` and `EXPO_PUBLIC_RAZORPAY_KEY_SECRET`
- `app.config.js` extra section (with fallback values)
- `config/razorpay.ts` (with fallback values)

## How It Works

### Payment Flow

1. **Order Creation**: User creates an order in the app (stored in Supabase)
2. **Payment Initialization**: When user selects a payment method (UPI, card, etc.), the `PaymentProcessor` component is shown
3. **Razorpay Checkout**: The service opens Razorpay's checkout UI with payment options
4. **Payment Processing**: User completes payment through Razorpay
5. **Verification**: Payment signature is verified (ideally on backend)
6. **Order Update**: On success, order status is updated in Supabase

### Current Implementation Details

```typescript
// Payment is initialized like this:
const response = await razorpayService.initializePayment({
  amount: 1000, // Amount in INR
  orderId: 'order-uuid', // Your internal order ID
  paymentMethod: 'upi', // or 'card', 'netbanking'
  userDetails: {
    name: 'John Doe',
    email: 'john@example.com',
    contact: '+919876543210'
  }
});
```

## Important Notes

### ✅ Edge Function Setup Required

**Current Status**: The code now includes a Supabase Edge Function to create Razorpay orders, but you need to:

1. **Deploy the Edge Function**:
   - Function is located at `supabase/functions/razorpay-function/`
   - Deploy using: `supabase functions deploy razorpay-function`
   - See `RAZORPAY_EDGE_FUNCTION_SETUP.md` for detailed instructions

2. **Set Environment Variables in Supabase**:
   - Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Add: `RAZORPAY_KEY_ID` (your **complete** key ID, not just `rzp_live_R`)
   - Add: `RAZORPAY_KEY_SECRET` (your complete key secret)

3. **Verify Your Razorpay Key ID**:
   - Your current key `rzp_live_R` appears incomplete
   - A complete key should be like: `rzp_live_xxxxxxxxxxxxx` (20+ characters)
   - Get the complete key from Razorpay Dashboard → Settings → API Keys

### ⚠️ Payment Verification

**Current Status**: Payment verification is done client-side (not secure for production)

For production, you should:
- Create a backend endpoint to verify payment signatures
- Use Razorpay's signature verification algorithm with your key secret
- Update `verifyPayment()` method to call your backend

### Recommended Backend Endpoints

You should create these endpoints on your backend:

#### 1. Create Razorpay Order
```
POST /api/payments/create-razorpay-order
Body: { amount, currency: "INR", receipt: "order-id" }
Response: { order_id: "order_xxx", amount, currency }
```

#### 2. Verify Payment
```
POST /api/payments/verify-razorpay-payment
Body: { payment_id, order_id, signature }
Response: { verified: true/false }
```

### Example Backend Implementation (Node.js)

```javascript
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create order
app.post('/api/payments/create-razorpay-order', async (req, res) => {
  const { amount, receipt } = req.body;
  
  const options = {
    amount: amount * 100, // Convert to paise
    currency: 'INR',
    receipt: receipt,
  };
  
  try {
    const order = await razorpay.orders.create(options);
    res.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify payment
app.post('/api/payments/verify-razorpay-payment', async (req, res) => {
  const { payment_id, order_id, signature } = req.body;
  
  const crypto = require('crypto');
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(order_id + '|' + payment_id)
    .digest('hex');
  
  const verified = generatedSignature === signature;
  res.json({ verified });
});
```

## Updating the Frontend Service

Once you have backend endpoints, update `services/payment/razorpayService.ts`:

```typescript
// Add method to create order via backend
async createOrder(amount: number, receipt: string): Promise<string> {
  const response = await fetch('https://your-api.com/api/payments/create-razorpay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, receipt, currency: 'INR' })
  });
  const data = await response.json();
  return data.order_id;
}

// Update verifyPayment to use backend
async verifyPayment(paymentId: string, orderId: string, signature: string): Promise<boolean> {
  const response = await fetch('https://your-api.com/api/payments/verify-razorpay-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: paymentId, order_id: orderId, signature })
  });
  const { verified } = await response.json();
  return verified;
}
```

## Testing

### Test Mode

Razorpay provides test credentials for development:
- Test Key ID: `rzp_test_xxx`
- Test Key Secret: `xxx`

Update your `.env` file:
```env
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx
EXPO_PUBLIC_RAZORPAY_KEY_SECRET=xxx
```

### Test Cards

Use these test cards for testing:
- **Success**: `4111 1111 1111 1111`
- **Failure**: `4000 0000 0000 0002`
- **CVV**: Any 3 digits
- **Expiry**: Any future date

## Security Best Practices

1. **Never expose key secret in frontend code**
2. **Always verify payments on backend**
3. **Use HTTPS for all API calls**
4. **Store credentials in environment variables**
5. **Implement proper error handling**
6. **Log payment transactions for audit**

## Troubleshooting

### Payment not initializing
- Check if Razorpay Key ID is correctly set
- Verify network connectivity
- Check console for error messages

### Payment verification fails
- Ensure you're using the correct key secret on backend
- Verify the signature algorithm matches Razorpay's documentation
- Check that order_id and payment_id are correct

### App crashes on payment
- Ensure `react-native-razorpay` is properly installed
- Run `npx pod-install` for iOS
- Rebuild the app after installing the package

## References

- [Razorpay React Native Documentation](https://razorpay.com/docs/payments/server-integration/react-native/)
- [Razorpay API Documentation](https://razorpay.com/docs/api/)
- [Payment Verification Guide](https://razorpay.com/docs/payments/server-integration/razorpay-signature-verification/)

## Support

For issues related to:
- **Razorpay Integration**: Check Razorpay documentation or contact their support
- **App-specific Issues**: Check the codebase or contact the development team

