# Alternative Approaches to Cleanup Pending Orders

## Current Problem
Orders are created in the database BEFORE payment is processed. If payment fails or user abandons, these orders remain in the database with `payment_status='pending'`.

## Alternative Solutions

### ✅ **BEST APPROACH: Don't Create Orders Until Payment Succeeds**

**Advantages:**
- No cleanup needed - orders only exist if payment succeeds
- Simpler architecture
- No database overhead from cleanup jobs
- More reliable - no orphaned orders

**Implementation:**
1. For COD: Create order immediately (payment guaranteed)
2. For online payments: 
   - Only create order AFTER payment succeeds
   - Store order data temporarily in app state/memory during payment
   - Create order in `handlePaymentSuccess` callback

**Trade-offs:**
- Need to handle payment failure gracefully (show error, allow retry)
- Cart items remain until payment succeeds
- Need to ensure order data is preserved during payment flow

### **Alternative 1: Supabase Edge Function with External Cron**

Use Supabase Edge Function called by external cron service (GitHub Actions, etc.)

**Advantages:**
- No pg_cron dependency
- Can use external scheduling services

**Disadvantages:**
- Requires external service setup
- More complex than pg_cron
- Still requires cleanup logic

**Example:**
```typescript
// supabase/functions/cleanup-pending-orders/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data, error } = await supabase.rpc('cleanup_pending_orders')
  
  return new Response(JSON.stringify({ success: !error, data }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

Then schedule via GitHub Actions, external cron service, etc.

### **Alternative 2: Database Triggers (Not Recommended)**

PostgreSQL triggers can't easily handle time-based cleanup without external scheduling.

**Why Not:**
- Triggers execute synchronously on insert/update
- Can't easily "schedule" a delete 5 minutes later
- Would require complex workarounds
- Not suitable for this use case

### **Alternative 3: Application-Level Polling (Not Recommended)**

Have the app periodically call cleanup function.

**Why Not:**
- Requires app to be running
- Inefficient
- Not reliable
- Better handled at database level

## Recommendation

**Use Approach #1: Only Create Orders After Payment Succeeds**

This is the cleanest solution and eliminates the cleanup problem entirely.

