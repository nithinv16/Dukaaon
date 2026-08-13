# Phase 1 — bug-condition counterexamples (client-authored payment state)

Recorded by task 2 of `.kiro/specs/critical-security-and-error-fixes`.

Property under test: **Property 1 — Paid State Requires Server-Verified Signature**
(design.md), covering bugfix clauses 1.4, 1.5, 1.6, 1.20 / 2.4, 2.5, 2.6, 2.20.

Test: `tests/payments/paymentIntegrity.bugCondition.property.test.tsx`
Command: `npx jest tests/payments/paymentIntegrity.bugCondition.property.test.tsx`
Result on the unfixed tree: **7 tests, 7 failed.** Every failure is a predicted
counterexample, so the root-cause analysis in design.md is **confirmed, not refuted**.
The same file turns green under task 11.5 and is what verifies the fix.

## What the harness runs

`handlePaymentSuccess` is exercised through the real screen: the checkout component is
rendered, its auto-pay effect opens the payment processor, and the test delivers a
callback triple through the `onSuccess` prop the screen hands `PaymentProcessor`. The
code under test is real. Postgres and the Deno edge function cannot run under Jest, so
`supabase.functions.invoke('verify-razorpay-payment')` is simulated: same HMAC over
`razorpay_order_id|razorpay_payment_id`, same `orders`-only lookup by `order_id`, same
200 + `{verified:false}` on mismatch, same 404 when the id is absent, and — like the
real function — it writes no payment state. The simulation already understands the
post-fix shapes (`master_order_id`, a server-side `mark_order_paid` transition) so the
generator broadens after the fix rather than being rewritten.

## Counterexamples, by source

### Source 1 — the client hardcodes `'paid'`

**Property test** (`never lets the client author paid state`). Failed after 1 test,
shrunk 22 times to the minimum:

```
cart:   [{ product_id: 'product-0', seller_id: 'seller-0', quantity: 1, price: 100 }]
triple: { razorpay_payment_id: 'pay_000000',
          razorpay_order_id:   'order_000000',
          razorpay_signature:  '00000000' }        // arbitrary → invalid HMAC

observed:
  clientWrotePaidState:        [{ table: 'orders', payment_status: 'paid',
                                  beforeVerification: true }]
  paidWithoutServerTransition: true
```

The shrink is important: **one seller, one item and an eight-character signature are
enough.** No special cart shape is needed, and the paid row is written *before*
verification is even attempted (`beforeVerification: true`).

**Case 1, single-seller** — a forged callback yields `payment_status: 'paid'` plus a
`payment_transactions` row at `status: 'completed'`.
Source: `app/(main)/checkout/index.tsx:321` (order insert) and the transaction insert
that follows it.

**Case 1b, multi-seller** — the client authors three paid rows before verification:

```
[ { table: 'master_orders', payment_status: 'paid', beforeVerification: true },
  { table: 'orders',        payment_status: 'paid', beforeVerification: true },
  { table: 'orders',        payment_status: 'paid', beforeVerification: true } ]
```

Source: `app/(main)/checkout/index.tsx:247` — `payment_status: 'paid'` is put into every
`ordersBySeller` payload handed to `MasterOrderService.placeCompleteOrder`.

### Source 2 — prefix-only `verifyPayment`

**Case 2** — `razorpayService.verifyPayment('pay_x', 'order_y', 'z')` returned `true`;
expected `false`. No HMAC is computed anywhere on the client.
Source: `services/payment/razorpayService.ts:439-480`.

### Source 3 — the `verified: false` verdict is ignored

**Case 3** — with `functions.invoke` resolving `{ data: { verified: false } }`:

```
expected: { successModalShown: false, cartCleared: false, paidOrders: 0 }
observed: { successModalShown: true,  cartCleared: true,  paidOrders: 1 }
```

The buyer sees "Order Confirmed!", the cart is emptied, and the order stays `paid`.
Source: the `console.warn`-only handling at `app/(main)/checkout/index.tsx:290-291` and
`:370-371`.

### The multi-seller prediction — confirmed

**Case 4** — a multi-seller checkout with a **genuine** signature. The client invokes
verification with `order_id = <master_orders.id>`; the function looks that id up in
`orders`:

```
expected: { data: { verified: true } }
observed: { data: null, error: { message: 'Order not found or access denied', status: 404 } }
```

**Case 4b (static)** — `supabase/functions/verify-razorpay-payment/index.ts` contains
neither `master_order_id` nor `master_orders`. It only ever selects from `orders` by
`order_id`.

Together these confirm the design's prediction: **the multi-seller path has never
verified anything, not even for genuine payments**, and the `console.warn` hid it. Task
11.2 has to accept both id shapes.

## Toolchain change this task required

Jest could not execute the multi-seller branch at all: `checkout/index.tsx:257` uses
`await import('../../../services/masterOrderService')`, `babel-preset-expo` leaves
`import()` native for Metro, and Jest's VM runs without `--experimental-vm-modules`, so
the call threw `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` and the screen's own
`catch` swallowed it into `setError`. A test-only Babel plugin was added under
`env.test` in `babel.config.js` that rewrites `import(x)` to
`Promise.resolve().then(() => require(x))`. Metro, EAS and release builds are untouched
(clause 3.12). Any later test that renders a screen using `await import(...)` — task 6's
multi-seller preservation observations included — depends on this.

One other harness trap, recorded so it is not rediscovered: in this Jest setup
`import 'react-native-paper'` and `require('react-native-paper')` resolve to **two
different module instances**. Mixing them gives the test's `Provider` a different
`PortalContext` than the screen's `Portal` consumes, which surfaces as paper's
"forgot to wrap your root component with Provider" error. The test imports paper the
same way the app does.

## Effect on the verification baseline

Compared with `docs/VERIFICATION_BASELINE.md`:

- `npm test`: 51 suites (was 50), **625 passing — unchanged**, 637 total, 12 failing
  (5 pre-existing + the 7 deliberate failures in this file).
- `npm run typecheck`: **632 errors — unchanged.** `tests/**` is excluded from the
  typecheck scope.

The 7 failures here are expected and must stay failing until Phase 1 lands. They are
not a regression, and they are the only new failures.
