/**
 * Bug-condition exploration test — Phase 1 payment integrity.
 *
 * Spec: .kiro/specs/critical-security-and-error-fixes (task 2)
 * Property 1: Bug Condition — Paid State Requires Server-Verified Signature
 *
 * **Validates: Requirements 1.4, 1.5, 1.6, 1.20, 2.4, 2.5, 2.6, 2.20**
 *
 * THIS SUITE IS EXPECTED TO FAIL ON THE UNFIXED TREE. Each failure is a
 * counterexample proving paid state is reachable without a server-verified HMAC.
 * Do not weaken the assertions to make it green — it turns green when tasks
 * 11.1-11.4 land, which is how the fix is verified (task 11.5).
 *
 * Bug condition under test (design.md `isBugCondition_C1`):
 *   paymentMethod != 'cod' AND a Razorpay callback exists AND paid state is
 *   written by the client AND (the HMAC is invalid OR the verdict is ignored).
 *
 * Assertion (design.md Property 1): payment_status == 'paid' if and only if
 * `verify-razorpay-payment` recomputed a matching HMAC and performed the
 * transition itself; the client never writes paid state; the success modal
 * appears if and only if the order is paid.
 *
 * What is real here and what is simulated:
 *   - REAL: `app/(main)/checkout/index.tsx` `handlePaymentSuccess` (the code
 *     under test), and `services/payment/razorpayService.verifyPayment`.
 *   - SIMULATED: Postgres and the Deno edge function, which cannot run in Jest.
 *     The `verify-razorpay-payment` simulation below mirrors the real function's
 *     logic line for line (HMAC over `order_id|payment_id`, lookup in `orders`
 *     by `order_id`, 200 + `{verified:false}` on mismatch, 404 when the id is
 *     not found in `orders`) and it never writes payment state, exactly like the
 *     real one. It also already understands the post-fix shapes
 *     (`master_order_id`, a `mark_order_paid` transition) so the same test
 *     broadens after the fix instead of being rewritten.
 */

// ---------------------------------------------------------------------------
// Harness state. Named `mockHarness` so babel-plugin-jest-hoist allows the
// jest.mock factories below to close over it.
// ---------------------------------------------------------------------------
const CryptoJS = require('crypto-js');

const TEST_KEY_SECRET = 'test_key_secret_for_hmac';
const TEST_USER_ID = 'user-under-test';

type WriteRecord = { table: string; payload: Record<string, any>; beforeVerification: boolean };

const mockHarness: any = {
  idSeq: 0,
  db: {} as Record<string, Record<string, any>[]>,
  clientWrites: [] as WriteRecord[],
  items: [] as any[],
  params: {} as Record<string, string | undefined>,
  capturedOnSuccess: null as null | ((t: any) => Promise<void>),
  verificationInvoked: false,
  verifyRequests: [] as any[],
  verifyResponses: [] as any[],
  forceVerifyResponse: null as any,
  serverMarkedPaid: false,
  successModalShown: false,
  cartCleared: false,
};

const hmacFor = (razorpayOrderId: string, razorpayPaymentId: string): string =>
  CryptoJS.HmacSHA256(`${razorpayOrderId}|${razorpayPaymentId}`, TEST_KEY_SECRET).toString(
    CryptoJS.enc.Hex
  );

function resetHarness(items: any[], params: Record<string, string | undefined> = {}) {
  mockHarness.idSeq = 0;
  mockHarness.db = { orders: [], master_orders: [], payment_transactions: [], seller_notifications: [] };
  mockHarness.clientWrites = [];
  mockHarness.items = items;
  mockHarness.params = { autoPay: 'true', ...params };
  mockHarness.capturedOnSuccess = null;
  mockHarness.verificationInvoked = false;
  mockHarness.verifyRequests = [];
  mockHarness.verifyResponses = [];
  mockHarness.forceVerifyResponse = null;
  mockHarness.serverMarkedPaid = false;
  mockHarness.successModalShown = false;
  mockHarness.cartCleared = false;
}

/**
 * Simulation of `supabase/functions/verify-razorpay-payment/index.ts`.
 * Mirrors the unfixed function: verifies the HMAC, resolves the order id in
 * `orders` only, returns 200 + {verified:false} on mismatch, 404 when the id is
 * absent, and NEVER writes payment state.
 */
async function mockSimulateVerifyRazorpayPayment(body: any) {
  mockHarness.verificationInvoked = true;
  mockHarness.verifyRequests.push(body);

  if (mockHarness.forceVerifyResponse) {
    mockHarness.verifyResponses.push(mockHarness.forceVerifyResponse);
    return mockHarness.forceVerifyResponse;
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id, master_order_id } = body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || (!order_id && !master_order_id)) {
    const res = { data: null, error: { message: 'Missing required fields', status: 400 } };
    mockHarness.verifyResponses.push(res);
    return res;
  }

  // Signature check — same text and algorithm as lines 88-95 of the edge function.
  if (hmacFor(razorpay_order_id, razorpay_payment_id) !== razorpay_signature) {
    const res = { data: { verified: false, error: 'Invalid payment signature' }, error: null };
    mockHarness.verifyResponses.push(res);
    return res;
  }

  // Ownership lookup. The unfixed function only ever queries `orders` by
  // `order_id`; `master_order_id` support is what task 11.2 adds.
  const target = master_order_id
    ? mockHarness.db.master_orders.find((m: any) => m.id === master_order_id && m.user_id === TEST_USER_ID)
    : mockHarness.db.orders.find((o: any) => o.id === order_id && o.user_id === TEST_USER_ID);

  if (!target) {
    const res = { data: null, error: { message: 'Order not found or access denied', status: 404 } };
    mockHarness.verifyResponses.push(res);
    return res;
  }

  // Post-fix behaviour: the server performs the transition itself via
  // mark_order_paid. The unfixed function never reaches a write at all, so on
  // the unfixed tree `serverMarkedPaid` stays false for every input.
  if (master_order_id) {
    mockHarness.db.master_orders
      .filter((m: any) => m.id === master_order_id)
      .forEach((m: any) => {
        m.payment_status = 'paid';
      });
    mockHarness.db.orders
      .filter((o: any) => o.master_order_id === master_order_id)
      .forEach((o: any) => {
        o.payment_status = 'paid';
      });
  } else {
    mockHarness.db.orders
      .filter((o: any) => o.id === order_id)
      .forEach((o: any) => {
        o.payment_status = 'paid';
      });
  }
  mockHarness.serverMarkedPaid = true;

  const res = {
    data: { verified: true, order_id: order_id ?? master_order_id, payment_id: razorpay_payment_id },
    error: null,
  };
  mockHarness.verifyResponses.push(res);
  return res;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-razorpay', () => ({ open: jest.fn() }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockHarness.params,
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: ({ children }: any) => React.createElement(View, null, children) };
});

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

// react-native-paper is NOT mocked: the screen is rendered inside a real
// PaperProvider so the success modal behaves as it does in the app. The text
// "Order Confirmed!" appearing in the tree is the observable for "the buyer was
// shown the success confirmation".
jest.mock('../../components/common/ConfirmationDialog', () => ({ ConfirmationDialog: () => null }));

jest.mock('../../components/payment/PaymentProcessor', () => ({
  PaymentProcessor: (props: any) => {
    // Stand-in for the Razorpay sheet: capture the callback the checkout screen
    // hands it so the test can deliver a callback triple.
    mockHarness.capturedOnSuccess = props.onSuccess;
    return null;
  },
}));

jest.mock('../../store/cart', () => {
  const state = {
    get items() {
      return mockHarness.items;
    },
    clearCart: async () => {
      mockHarness.cartCleared = true;
    },
    splitCartBySeller: () => {
      const bySeller: Record<string, any[]> = {};
      mockHarness.items.forEach((item: any) => {
        bySeller[item.seller_id] = bySeller[item.seller_id] || [];
        bySeller[item.seller_id].push(item);
      });
      return bySeller;
    },
  };
  const useCartStore: any = (selector?: any) => (selector ? selector(state) : state);
  useCartStore.getState = () => state;
  return { useCartStore };
});

jest.mock('../../store/payment', () => {
  const state = {
    defaultMethod: { id: 'pm-1', type: 'razorpay', title: 'Razorpay', details: {} },
  };
  const usePaymentStore: any = (selector?: any) => (selector ? selector(state) : state);
  usePaymentStore.getState = () => state;
  return { usePaymentStore };
});

jest.mock('../../store/auth', () => {
  const state = {
    user: {
      id: 'user-under-test',
      latitude: 12.9,
      longitude: 77.6,
      business_details: {
        shopName: 'Test Shop',
        address: '1 Test Road',
        city: 'Bengaluru',
        state: 'KA',
        postal_code: '560001',
      },
    },
  };
  const useAuthStore: any = (selector?: any) => (selector ? selector(state) : state);
  useAuthStore.getState = () => state;
  return { useAuthStore };
});

jest.mock('../../services/supabase/supabase', () => {
  const insertInto = (table: string, payload: any) => {
    const rows = (Array.isArray(payload) ? payload : [payload]).map((row: any) => ({
      id: `${table}-${++mockHarness.idSeq}`,
      ...row,
    }));
    rows.forEach((row: any) =>
      mockHarness.clientWrites.push({
        table,
        payload: row,
        beforeVerification: !mockHarness.verificationInvoked,
      })
    );
    mockHarness.db[table] = (mockHarness.db[table] || []).concat(rows);
    return rows;
  };

  return {
    supabase: {
      from: (table: string) => ({
        insert: (payload: any) => {
          const rows = insertInto(table, payload);
          const settled = { data: rows, error: null };
          return {
            select: () => ({
              single: async () => ({ data: rows[0], error: null }),
              maybeSingle: async () => ({ data: rows[0], error: null }),
            }),
            then: (onOk: any, onErr: any) => Promise.resolve(settled).then(onOk, onErr),
          };
        },
        update: (payload: any) => {
          // Supports the pending-then-verify flow: e.g. setting payment_initiated_at
          const filters: Record<string, any> = {};
          const query: any = {
            eq: (column: string, value: any) => {
              filters[column] = value;
              return query;
            },
            select: () => query,
            single: async () => {
              const rows = (mockHarness.db[table] || []).filter((candidate: any) =>
                Object.entries(filters).every(([k, v]) => candidate[k] === v)
              );
              rows.forEach((row: any) => Object.assign(row, payload));
              return { data: rows[0] ?? null, error: null };
            },
            then: (onOk: any, onErr: any) => {
              const rows = (mockHarness.db[table] || []).filter((candidate: any) =>
                Object.entries(filters).every(([k, v]) => candidate[k] === v)
              );
              rows.forEach((row: any) => Object.assign(row, payload));
              return Promise.resolve({ data: rows, error: null }).then(onOk, onErr);
            },
          };
          return query;
        },
        select: () => {
          const filters: Record<string, any> = {};
          const query: any = {
            eq: (column: string, value: any) => {
              filters[column] = value;
              return query;
            },
            single: async () => {
              const row = (mockHarness.db[table] || []).find((candidate: any) =>
                Object.entries(filters).every(([k, v]) => candidate[k] === v)
              );
              return row
                ? { data: row, error: null }
                : { data: null, error: { message: 'No rows found' } };
            },
            maybeSingle: async () => {
              const row = (mockHarness.db[table] || []).find((candidate: any) =>
                Object.entries(filters).every(([k, v]) => candidate[k] === v)
              );
              return { data: row ?? null, error: null };
            },
          };
          return query;
        },
      }),
      functions: {
        invoke: async (name: string, options: any) => {
          if (name !== 'verify-razorpay-payment') {
            return { data: null, error: { message: `unexpected function ${name}` } };
          }
          return mockSimulateVerifyRazorpayPayment(options?.body ?? {});
        },
      },
    },
  };
});

jest.mock('../../services/masterOrderService', () => ({
  MasterOrderService: {
    // Mirrors the real service's contract: it inserts the master order plus one
    // order per seller using exactly the payloads the client handed it.
    placeCompleteOrder: async (
      userId: string,
      ordersBySeller: Record<string, any>,
      _deliveryAddress: any,
      totalAmount: number,
      deliveryFee: number,
      paymentMethod: string
    ) => {
      const masterOrderId = `master-${++mockHarness.idSeq}`;
      const sellerPayloads = Object.values(ordersBySeller);
      // The master row's payment status follows what the client supplied for
      // its child orders — clause 1.4's "sets payment_status: 'paid' in
      // ordersBySeller".
      const clientSuppliedStatus = (sellerPayloads[0] as any)?.payment_status ?? 'pending';

      const masterRow = {
        id: masterOrderId,
        user_id: userId,
        total_amount: totalAmount,
        delivery_fee: deliveryFee,
        payment_method: paymentMethod,
        payment_status: clientSuppliedStatus,
        payment_initiated_at: (sellerPayloads[0] as any)?.payment_initiated_at ?? null,
      };
      mockHarness.db.master_orders.push(masterRow);
      mockHarness.clientWrites.push({
        table: 'master_orders',
        payload: masterRow,
        beforeVerification: !mockHarness.verificationInvoked,
      });

      sellerPayloads.forEach((payload: any) => {
        const row = { id: `orders-${++mockHarness.idSeq}`, master_order_id: masterOrderId, ...payload };
        mockHarness.db.orders.push(row);
        mockHarness.clientWrites.push({
          table: 'orders',
          payload: row,
          beforeVerification: !mockHarness.verificationInvoked,
        });
      });

      return { success: true, masterOrderId };
    },
  },
}));

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
// Imported (not `require`d) on purpose: under this Jest setup an `import` of
// react-native-paper and a `require` of it yield two different module
// instances, and the checkout screen uses `import`. Mixing them gives the
// Provider a different PortalContext than the screen's Portal consumes, which
// surfaces as paper's "forgot to wrap your root component with Provider" error.
import { Provider as PaperProvider } from 'react-native-paper';

type Observation = {
  clientPaidWrites: { table: string; payment_status: string; beforeVerification: boolean }[];
  finalPaidOrderCount: number;
  serverMarkedPaid: boolean;
  successModalShown: boolean;
  cartCleared: boolean;
  verifyRequests: any[];
  verifyResponses: any[];
  orders: Record<string, any>[];
  masterOrders: Record<string, any>[];
  paymentTransactions: Record<string, any>[];
};

async function runCheckoutWithCallback(items: any[], triple: any, opts: any = {}): Promise<Observation> {
  resetHarness(items);
  if (opts.forceVerifyResponse) mockHarness.forceVerifyResponse = opts.forceVerifyResponse;

  const React = require('react');
  const ReactTestRenderer = require('react-test-renderer');
  const act = (React as any).act ?? ReactTestRenderer.act;
  const Checkout = require('../../app/(main)/checkout/index').default;

  // React 19's `act` collects anything thrown during render or effects into an
  // AggregateError with no message, which hides the real cause. Unwrap it.
  const actOrExplain = async (label: string, fn: () => Promise<void> | void) => {
    try {
      await act(fn as any);
    } catch (err: any) {
      const nested = Array.isArray(err?.errors)
        ? err.errors.map((e: any) => e?.stack || e?.message || String(e)).join('\n---\n')
        : err?.stack || err?.message || String(err);
      throw new Error(`Harness failure during ${label}:\n${nested}`);
    }
  };

  let tree: any;
  await actOrExplain('initial render', async () => {
    tree = ReactTestRenderer.create(
      React.createElement(PaperProvider, null, React.createElement(Checkout))
    );
  });

  if (!mockHarness.capturedOnSuccess) {
    throw new Error(
      'Harness setup failure: the checkout screen never rendered PaymentProcessor, ' +
        'so no Razorpay callback could be delivered.'
    );
  }

  await actOrExplain('payment callback', async () => {
    await mockHarness.capturedOnSuccess!(triple);
  });

  const renderedText = JSON.stringify(tree.toJSON() ?? null);
  mockHarness.successModalShown = renderedText.includes('Order Confirmed!');

  await actOrExplain('unmount', async () => {
    tree.unmount();
  });

  const paidWrites = mockHarness.clientWrites
    .filter(
      (w: WriteRecord) =>
        (w.table === 'orders' || w.table === 'master_orders') && w.payload.payment_status === 'paid'
    )
    .map((w: WriteRecord) => ({
      table: w.table,
      payment_status: w.payload.payment_status,
      beforeVerification: w.beforeVerification,
    }));

  return {
    clientPaidWrites: paidWrites,
    finalPaidOrderCount: mockHarness.db.orders.filter((o: any) => o.payment_status === 'paid').length,
    serverMarkedPaid: mockHarness.serverMarkedPaid,
    successModalShown: mockHarness.successModalShown,
    cartCleared: mockHarness.cartCleared,
    verifyRequests: mockHarness.verifyRequests,
    verifyResponses: mockHarness.verifyResponses,
    orders: mockHarness.db.orders,
    masterOrders: mockHarness.db.master_orders,
    paymentTransactions: mockHarness.db.payment_transactions,
  };
}

// ---------------------------------------------------------------------------
// Generators — scoped to the concrete failing shapes, keeping Property 1's
// domain (1-5 sellers, 1-20 items) so the same test broadens after the fix.
// ---------------------------------------------------------------------------
const cartArb = fc
  .tuple(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 20 }))
  .map(([sellerCount, itemCount]) => {
    const size = Math.max(sellerCount, itemCount);
    return Array.from({ length: size }, (_, i) => ({
      product_id: `product-${i}`,
      seller_id: `seller-${i % sellerCount}`,
      quantity: (i % 3) + 1,
      price: 100 + i,
      name: `Item ${i}`,
      unit: 'pc',
    }));
  });

const hexStringArb = (minLength: number, maxLength: number) =>
  fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength, maxLength })
    .map(chars => chars.join(''));

/** Arbitrary callback triples — i.e. the HMAC is invalid (forged or replayed). */
const forgedTripleArb = fc
  .record({
    razorpay_payment_id: hexStringArb(6, 20).map(s => `pay_${s}`),
    razorpay_order_id: hexStringArb(6, 20).map(s => `order_${s}`),
    razorpay_signature: hexStringArb(8, 64),
  })
  .filter(t => t.razorpay_signature !== hmacFor(t.razorpay_order_id, t.razorpay_payment_id));

const singleSellerCart = [
  { product_id: 'p1', seller_id: 'seller-0', quantity: 2, price: 150, name: 'Rice 5kg', unit: 'bag' },
];
const multiSellerCart = [
  { product_id: 'p1', seller_id: 'seller-0', quantity: 2, price: 150, name: 'Rice 5kg', unit: 'bag' },
  { product_id: 'p2', seller_id: 'seller-1', quantity: 1, price: 300, name: 'Oil 5L', unit: 'can' },
];
const forgedTriple = {
  razorpay_payment_id: 'pay_forged000000',
  razorpay_order_id: 'order_forged0000',
  razorpay_signature: 'deadbeefdeadbeefdeadbeefdeadbeef',
};

// ---------------------------------------------------------------------------
// Property 1 — Bug Condition
// ---------------------------------------------------------------------------
describe('Property 1: Bug Condition — Paid State Requires Server-Verified Signature', () => {
  it('never lets the client author paid state, for any cart crossed with any forged callback triple', async () => {
    await fc.assert(
      fc.asyncProperty(cartArb, forgedTripleArb, async (items, triple) => {
        const observed = await runCheckoutWithCallback(items, triple);

        // Property 1, all three clauses in one comparison so a counterexample
        // reports which clause broke.
        expect({
          clientWrotePaidState: observed.clientPaidWrites,
          paidWithoutServerTransition: observed.finalPaidOrderCount > 0 && !observed.serverMarkedPaid,
          successModalWithoutPaidOrder:
            observed.successModalShown && observed.finalPaidOrderCount === 0,
        }).toEqual({
          clientWrotePaidState: [],
          paidWithoutServerTransition: false,
          successModalWithoutPaidOrder: false,
        });
      }),
      { numRuns: 15 }
    );
  }, 120000);

  it('case 1 (client hardcodes paid): a forged callback on a single-seller cart does not produce a paid order', async () => {
    const observed = await runCheckoutWithCallback(singleSellerCart, forgedTriple);

    // checkout/index.tsx:321 inserts payment_status: 'paid' outright.
    expect(observed.orders.map(o => o.payment_status)).not.toContain('paid');
    expect(observed.paymentTransactions.map(t => t.status)).not.toContain('completed');
  }, 30000);

  it('case 1b (client hardcodes paid, multi-seller): no paid state is authored by the client', async () => {
    const observed = await runCheckoutWithCallback(multiSellerCart, forgedTriple);

    // checkout/index.tsx:247 puts payment_status: 'paid' into every
    // ordersBySeller payload handed to MasterOrderService.placeCompleteOrder.
    expect(observed.clientPaidWrites).toEqual([]);
  }, 30000);

  it('case 2 (prefix-only verifyPayment): client-side verification method no longer exists', async () => {
    const { razorpayService } = require('../../services/payment/razorpayService');

    // verifyPayment has been deleted outright (task 11.4) — a method that must
    // never be trusted is better absent than present-and-throwing.
    expect(razorpayService.verifyPayment).toBeUndefined();
  });

  it('case 3 (ignored verified:false): a false verdict blocks the success modal and the paid state', async () => {
    const observed = await runCheckoutWithCallback(singleSellerCart, forgedTriple, {
      forceVerifyResponse: { data: { verified: false }, error: null },
    });

    // checkout/index.tsx:290-291 and :370-371 only console.warn on this verdict.
    expect({
      successModalShown: observed.successModalShown,
      cartCleared: observed.cartCleared,
      paidOrders: observed.finalPaidOrderCount,
    }).toEqual({ successModalShown: false, cartCleared: false, paidOrders: 0 });
  }, 30000);

  it('case 4 (multi-seller verification): a genuine signature verifies against a master order id', async () => {
    const genuineTriple = {
      razorpay_payment_id: 'pay_genuine00001',
      razorpay_order_id: 'order_genuine001',
      razorpay_signature: hmacFor('order_genuine001', 'pay_genuine00001'),
    };

    const observed = await runCheckoutWithCallback(multiSellerCart, genuineTriple);

    // The client sends the master order id as `order_id`; the edge function
    // looks it up in `orders` and 404s, so multi-seller has never verified.
    expect(observed.verifyResponses[0]).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ verified: true }) })
    );
  }, 30000);

  it('case 4b (multi-seller verification, static): the edge function resolves a master order id', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../supabase/functions/verify-razorpay-payment/index.ts'),
      'utf8'
    );

    // Today it only ever selects from `orders` by `order_id`.
    expect(source).toContain('master_order_id');
    expect(source).toContain('master_orders');
  });
});
