# Payment Confirmation and Failure Handling

## Overview
This document describes how payment confirmations and failures are handled in the DukaaOn app, including database updates and error handling.

## Payment Flow

### 1. Order Creation (`handlePayment`)
- Creates order in `orders` table with `payment_status: 'pending'`
- Creates payment transaction in `payment_transactions` table with `status: 'pending'`
- For COD: Order is immediately marked as placed (no payment needed)
- For online payments: Opens Razorpay checkout

### 2. Payment Processing (`PaymentProcessor`)
- Initiates Razorpay payment
- Handles payment response
- Verifies payment signature (client-side)
- Calls `onSuccess` with payment details or `onFailure` with error

### 3. Payment Success (`handlePaymentSuccess`)

**Database Updates:**
1. **payment_transactions** table:
   - Updates `status` from `'pending'` to `'completed'`
   - Sets `transaction_id` to Razorpay payment ID
   - Clears `error_message`
   - Updates `updated_at` timestamp

2. **orders** table:
   - Updates `payment_status` from `'pending'` to `'paid'`
   - Updates `status` from `'pending'` to `'confirmed'`
   - Updates `updated_at` timestamp

3. **Server-side Verification:**
   - Calls `verify-razorpay-payment` Edge Function
   - Verifies payment signature using Razorpay Key Secret
   - Ensures order belongs to authenticated user
   - Logs verification result (doesn't fail if verification function unavailable)

**User Experience:**
- Shows success modal
- Clears cart
- Redirects to orders page

### 4. Payment Failure (`handlePaymentFailure`)

**Database Updates:**
1. **payment_transactions** table:
   - Updates `status` from `'pending'` to `'failed'`
   - Sets `error_message` with failure reason (max 500 chars)
   - Updates `updated_at` timestamp

2. **orders** table:
   - `payment_status` remains `'pending'` (allows retry)
   - `status` remains `'pending'` (order not confirmed)

**Special Cases:**
- **Payment Cancellation**: Not treated as failure
  - No database update
  - User-friendly message shown
  - User can retry payment

**User Experience:**
- Shows error message
- Hides payment processor
- User can retry or change payment method

## Error Handling

### Network Failures
- If database update fails after payment success:
  - Error is logged
  - User is shown error with payment ID
  - User should contact support with payment ID
  - Payment was successful at Razorpay, but order update failed

### Partial Updates
- If payment_transactions update fails but order update succeeds:
  - Error is logged
  - Payment is still considered successful
  - Order status is updated correctly

### Missing Transaction Record
- If payment_transactions record doesn't exist:
  - New record is created with success status
  - This handles edge cases where transaction wasn't created initially

## Security

### Payment Verification
1. **Client-side** (in PaymentProcessor):
   - Basic format validation
   - Not secure - can be bypassed

2. **Server-side** (Edge Function):
   - HMAC SHA256 signature verification
   - Uses Razorpay Key Secret (never exposed to client)
   - Verifies order ownership
   - Secure and reliable

### Best Practices
- Always verify payment server-side before updating order status
- Store payment IDs for audit trail
- Log all payment operations for debugging
- Handle edge cases gracefully

## Database Schema

### payment_transactions
- `id`: UUID (primary key)
- `order_id`: UUID (foreign key to orders)
- `amount`: DECIMAL (payment amount)
- `status`: TEXT ('pending' | 'processing' | 'completed' | 'failed')
- `payment_method`: TEXT (mapped from payment method type)
- `transaction_id`: TEXT (Razorpay payment ID)
- `error_message`: TEXT (failure reason, max 500 chars)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### orders
- `id`: UUID (primary key)
- `payment_status`: TEXT ('pending' | 'partial' | 'paid' | 'overdue')
- `status`: TEXT (order status)
- `payment_method`: TEXT (mapped payment method)
- `updated_at`: TIMESTAMP

## Testing Checklist

- [ ] Payment success updates both tables correctly
- [ ] Payment failure updates payment_transactions only
- [ ] Payment cancellation doesn't update database
- [ ] Network failure during update shows appropriate error
- [ ] Missing transaction record is handled
- [ ] Server-side verification works correctly
- [ ] Payment IDs are stored for audit trail
- [ ] User can retry after failure
- [ ] Order status transitions correctly

## Troubleshooting

### Payment successful but order not updated
- Check server logs for database errors
- Verify Edge Function is deployed
- Check RLS policies allow updates
- User should contact support with payment ID

### Payment failed but transaction shows success
- Check error logs
- Verify payment_transactions update query
- Check for race conditions
- Review payment flow logic

### Duplicate payment transactions
- Check if transaction already exists before creating
- Use unique constraints if needed
- Handle idempotency

