/**
 * Bug-condition exploration test — cleanup job safety.
 *
 * Spec: .kiro/specs/critical-security-and-error-fixes (task 5)
 * Property 4: Bug Condition — Cleanup Never Deletes an In-Flight or Paid Order
 *
 * **Validates: Requirements 1.20, 2.5, 3.6**
 *
 * THIS SUITE IS EXPECTED TO FAIL ON THE UNFIXED SCHEMA. Each failure is a
 * counterexample against the predicate committed in
 * `supabase/migrations/20250128000000_cleanup_pending_orders.sql`. Do not weaken
 * an assertion to make it green, and do not edit that migration from here —
 * task 12.1 owns the fix and task 12.2 re-runs this file to verify it.
 *
 * ---------------------------------------------------------------------------
 * Two halves, same split as the task 3 probe
 * ---------------------------------------------------------------------------
 *
 *   1. MODEL + STATIC — always runs, no database required. The predicate is
 *      **extracted** from the committed migration (not transcribed) and
 *      evaluated as a property-based test over generated order rows. Because
 *      both defects live in the predicate's logic rather than in Postgres's
 *      execution of it, a universally quantified result over the extracted
 *      predicate is a real result about the shipped function, not a stand-in.
 *      The extractor reads the **latest** migration that defines
 *      `cleanup_pending_orders`, so when task 12.1 lands its replacement this
 *      same file measures the new predicate automatically.
 *
 *   2. EMPIRICAL — seeds real rows, calls the real `cleanup_pending_orders()`,
 *      and checks what survived. Requires a local (`supabase start`) or
 *      explicitly provisioned branch database. SKIPPED with a printed reason
 *      when none is configured. Never runs against production: a non-local URL
 *      needs `PROBE_ALLOW_REMOTE=yes`, and the known production project ref is
 *      hard-blocked.
 *
 * What the model half cannot tell you: whether the committed migration is the
 * one actually applied to the running database. The design already flagged
 * migration drift and task 10 is scheduled to resolve it. Treat the model
 * result as a statement about the committed predicate, and run the empirical
 * half before treating the fix as verified.
 *
 * Env contract for the empirical half (identical to task 3):
 *   PROBE_SUPABASE_URL               e.g. http://127.0.0.1:54321
 *   PROBE_SUPABASE_ANON_KEY          not the subject here, but kept for parity
 *   PROBE_SUPABASE_SERVICE_ROLE_KEY  seeds rows and invokes the cleanup RPC
 *   PROBE_ALLOW_REMOTE=yes           required when the URL is not localhost
 *
 * !! The empirical half calls the REAL cleanup function, which deletes every
 * matching row in the target database, not only the probe's own rows. Local or
 * throwaway branch databases only.
 *
 * The equivalent probe as a psql script is
 * `supabase/probes/cleanup_pending_orders_probe.sql`.
 */

import fs from 'fs';
import path from 'path';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');
const CLEANUP_FUNCTION = 'cleanup_pending_orders';

/**
 * The grace window the spec requires, in minutes. This is a **specification
 * constant** taken from design.md §1e and tasks.md 12.1 — deliberately NOT
 * extracted from the predicate. Deriving it from the thing under test would
 * make every window-related property vacuously true for any predicate.
 *
 * If the chosen window ever changes, change it here and say so in the design.
 */
const GRACE_WINDOW_MINUTES = 15;

/**
 * Order-status values. The committed CHECK list from
 * `20251003112500_update_orders_status_constraint.sql`, plus `'placed'`, which
 * `app/(main)/checkout/index.tsx` writes at lines 135, 246 and 320 and which is
 * **absent** from that list. That drift is pre-existing and out of scope here
 * (task 10 records what the live schema actually is), but `'placed'` has to be
 * in the domain because it is the value the real rows carry.
 */
const ORDER_STATUSES = [
  'draft',
  'pending',
  'placed',
  'confirmed',
  'preparing',
  'ready',
  'accepted',
  'processing',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'shipped',
  'delivered',
  'cancelled',
  'completed',
  'rejected',
] as const;

/** `orders.payment_status` CHECK list, `20250105000000_create_orders.sql:26`. */
const PAYMENT_STATUSES = ['pending', 'partial', 'paid', 'overdue'] as const;

/**
 * `orders.payment_method` CHECK list, `20250120000001_update_orders_payment_method_constraint.sql:21`.
 *
 * Worth knowing before reading any result below: checkout does not write these
 * names directly. `mapPaymentMethod` (`app/(main)/checkout/index.tsx:64-78`)
 * folds them first — `'cod' -> 'cash'`, `'razorpay' | 'card' | 'netbanking' ->
 * 'online'`, `'upi' -> 'upi'`, and anything unrecognised -> `'cash'`. So a
 * Razorpay order is stored as `'online'`, never as `'razorpay'`, and the
 * `'razorpay'` value used in the task description and the design's test case is
 * one the checkout path never produces. The `'cod'` and `'razorpay'` values do
 * appear from the AI/WhatsApp order paths.
 */
const PAYMENT_METHODS = [
  'cash',
  'credit',
  'online',
  'upi',
  'razorpay',
  'cod',
  'card',
  'netbanking',
] as const;

/** Methods whose money is taken through the online sheet, so a marker is set. */
const ONLINE_METHODS = ['online', 'upi', 'razorpay', 'card', 'netbanking'] as const;

/**
 * Methods where nothing is collected at checkout, so no in-flight marker is
 * ever set. `'cod'` and `'cash'` are what the app writes; `'credit'` is allowed
 * by the CHECK but no code path writes it today — see the doc for why it is
 * excluded from the asserted set and recorded as a latent hazard instead.
 */
const OFFLINE_METHODS = ['cod', 'cash'] as const;

// ---------------------------------------------------------------------------
// The row model
// ---------------------------------------------------------------------------

/**
 * An order row, with timestamps expressed as an age in minutes rather than an
 * absolute value. `null` means SQL NULL. Ages are what the predicate compares,
 * and using them keeps the model free of clock skew.
 */
type OrderRow = {
  payment_status: string;
  status: string;
  payment_method: string;
  /** minutes since `created_at`. */
  created_at_age: number;
  /** minutes since `payment_initiated_at`, or null when the column is NULL. */
  payment_initiated_at_age: number | null;
};

const columnAge = (row: OrderRow, column: string): number | null => {
  switch (column) {
    case 'created_at':
      return row.created_at_age;
    case 'payment_initiated_at':
      return row.payment_initiated_at_age;
    default:
      throw new Error(`predicate references timestamp column the model does not carry: ${column}`);
  }
};

const columnText = (row: OrderRow, column: string): string | null => {
  switch (column) {
    case 'payment_status':
      return row.payment_status;
    case 'status':
      return row.status;
    case 'payment_method':
      return row.payment_method;
    default:
      throw new Error(`predicate references text column the model does not carry: ${column}`);
  }
};

// ---------------------------------------------------------------------------
// Extracting the predicate from the committed migration
// ---------------------------------------------------------------------------

/** SQL three-valued logic. `null` is UNKNOWN. */
type Tri = boolean | null;

type Condition = {
  source: string;
  column: string;
  evaluate: (row: OrderRow) => Tri;
};

type ExtractedPredicate = {
  migrationFile: string;
  whereClause: string;
  conditions: Condition[];
  /** Minutes in the age threshold, and the column it applies to. */
  window: { column: string; minutes: number } | null;
  /** Minute period of the pg_cron schedule, when one is declared. */
  cronPeriodMinutes: number | null;
};

function migrationsDefining(fn: string): { file: string; sql: string }[] {
  const declares = new RegExp(
    `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${fn}\\s*\\(`,
    'i'
  );
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((n) => n.endsWith('.sql'))
    // Migration filenames are timestamp-prefixed, so lexicographic order is
    // apply order. The last definition wins, which is how CREATE OR REPLACE
    // behaves and how task 12.1's replacement gets picked up here for free.
    .sort()
    .map((file) => ({ file, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8') }))
    .filter((m) => declares.test(m.sql));
}

const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, ' ');

/**
 * Splits an AND-joined WHERE clause, ignoring `AND` inside parentheses or
 * string literals. Throws on anything it cannot split faithfully, because a
 * silently mis-parsed predicate would produce a confident wrong answer.
 */
function splitTopLevelAnd(clause: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;
  while (i < clause.length) {
    const ch = clause[i];
    if (ch === "'") {
      let j = i + 1;
      while (j < clause.length && clause[j] !== "'") j++;
      current += clause.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && /\s/.test(ch)) {
      const and = /^\s+AND\s+/i.exec(clause.slice(i));
      if (and) {
        parts.push(current.trim());
        current = '';
        i += and[0].length;
        continue;
      }
      const or = /^\s+OR\s+/i.exec(clause.slice(i));
      if (or) {
        throw new Error(
          'predicate contains a top-level OR, which this model does not implement. ' +
            'Extend the parser rather than approximating it.'
        );
      }
    }
    current += ch;
    i++;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const INTERVAL_TO_MINUTES: Record<string, number> = {
  minute: 1,
  minutes: 1,
  hour: 60,
  hours: 60,
  day: 1440,
  days: 1440,
};

function compileCondition(text: string): Condition {
  const source = text.replace(/\s+/g, ' ').trim();

  // col IS [NOT] NULL
  let m = /^([a-z_]+)\s+IS\s+(NOT\s+)?NULL$/i.exec(source);
  if (m) {
    const column = m[1];
    const negated = !!m[2];
    return {
      source,
      column,
      evaluate: (row) => {
        const isNull = columnAge(row, column) === null;
        return negated ? !isNull : isNull;
      },
    };
  }

  // col < NOW() - INTERVAL 'n minutes'   (and the >, <=, >= forms)
  m = /^([a-z_]+)\s*(<=|>=|<|>)\s*NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*([a-z]+)'$/i.exec(source);
  if (m) {
    const [, column, op, n, unit] = m;
    const scale = INTERVAL_TO_MINUTES[unit.toLowerCase()];
    if (!scale) throw new Error(`unsupported interval unit in predicate: '${unit}'`);
    const threshold = Number(n) * scale;
    return {
      source,
      column,
      // `col < NOW() - INTERVAL 'T'` is "older than T", i.e. age > T.
      evaluate: (row) => {
        const age = columnAge(row, column);
        if (age === null) return null; // NULL comparison is UNKNOWN
        switch (op) {
          case '<':
            return age > threshold;
          case '<=':
            return age >= threshold;
          case '>':
            return age < threshold;
          default:
            return age <= threshold;
        }
      },
    };
  }

  // col [NOT] IN ('a', 'b')
  m = /^([a-z_]+)\s+(NOT\s+)?IN\s*\(\s*((?:'[^']*'\s*,?\s*)+)\)$/i.exec(source);
  if (m) {
    const column = m[1];
    const negated = !!m[2];
    const values = (m[3].match(/'([^']*)'/g) || []).map((v) => v.slice(1, -1));
    return {
      source,
      column,
      evaluate: (row) => {
        const value = columnText(row, column);
        if (value === null) return null;
        const member = values.includes(value);
        return negated ? !member : member;
      },
    };
  }

  // col = 'x' / col != 'x' / col <> 'x'
  m = /^([a-z_]+)\s*(=|!=|<>)\s*'([^']*)'$/.exec(source);
  if (m) {
    const [, column, op, value] = m;
    return {
      source,
      column,
      evaluate: (row) => {
        const actual = columnText(row, column);
        if (actual === null) return null;
        return op === '=' ? actual === value : actual !== value;
      },
    };
  }

  throw new Error(
    `cannot model this predicate condition: "${source}". ` +
      'Extend compileCondition rather than letting the model guess.'
  );
}

function extractPredicate(): ExtractedPredicate {
  const defining = migrationsDefining(CLEANUP_FUNCTION);
  if (defining.length === 0) {
    throw new Error(
      `no migration under supabase/migrations defines ${CLEANUP_FUNCTION}(). ` +
        'The predicate under test cannot be located.'
    );
  }
  const latest = defining[defining.length - 1];
  const sql = stripComments(latest.sql);

  const del = /DELETE\s+FROM\s+(?:public\.)?orders\b([\s\S]*?)(?:\bRETURNING\b|;)/i.exec(sql);
  if (!del) {
    throw new Error(`${latest.file} defines ${CLEANUP_FUNCTION}() but has no DELETE FROM orders.`);
  }
  const where = /\bWHERE\b([\s\S]*)$/i.exec(del[1]);
  if (!where) {
    throw new Error(
      `${latest.file}: DELETE FROM orders has no WHERE clause — it would delete every order.`
    );
  }

  const whereClause = where[1].replace(/\s+/g, ' ').trim();
  const conditions = splitTopLevelAnd(whereClause).map(compileCondition);

  const ageCondition = conditions.find((c) =>
    /NOW\(\)\s*-\s*INTERVAL/i.test(c.source)
  );
  let window: ExtractedPredicate['window'] = null;
  if (ageCondition) {
    const m = /INTERVAL\s*'(\d+)\s*([a-z]+)'/i.exec(ageCondition.source)!;
    window = {
      column: ageCondition.column,
      minutes: Number(m[1]) * INTERVAL_TO_MINUTES[m[2].toLowerCase()],
    };
  }

  // '*/5 * * * *' -> 5
  const cron = /cron\.schedule\s*\(\s*'[^']*'\s*,\s*'\*\/(\d+) /i.exec(latest.sql);

  return {
    migrationFile: latest.file,
    whereClause,
    conditions,
    window,
    cronPeriodMinutes: cron ? Number(cron[1]) : null,
  };
}

const predicate = extractPredicate();

/** SQL AND folding: FALSE dominates, then UNKNOWN, else TRUE. */
function evaluatePredicate(row: OrderRow): Tri {
  let unknown = false;
  for (const condition of predicate.conditions) {
    const value = condition.evaluate(row);
    if (value === false) return false;
    if (value === null) unknown = true;
  }
  return unknown ? null : true;
}

/** A row is deleted only when the WHERE clause evaluates to TRUE. */
const isDeleted = (row: OrderRow): boolean => evaluatePredicate(row) === true;

/**
 * `SPARED` / `DELETED`, followed by every condition and how it evaluated.
 * Asserting on this string rather than on a boolean means a failing property
 * prints *why* the predicate reached its verdict, not just that it did.
 */
const verdict = (row: OrderRow): string =>
  `${isDeleted(row) ? 'DELETED' : 'SPARED'} [` +
  predicate.conditions.map((c) => `${c.source} => ${String(c.evaluate(row))}`).join(' | ') +
  ']';

const SPARED = /^SPARED/;
const DELETED = /^DELETED/;

// ---------------------------------------------------------------------------
// The `mark_order_paid` transition, as the design specifies it
// ---------------------------------------------------------------------------

/**
 * design.md §1e: `mark_order_paid` sets `payment_status = 'paid'` and clears
 * `payment_initiated_at` in the **same** UPDATE. Modelled as one step so the
 * interleaving property below can also ask what happens if it were ever split.
 */
const markOrderPaid = (row: OrderRow): OrderRow => ({
  ...row,
  payment_status: 'paid',
  payment_initiated_at_age: null,
});

/** The state that would exist if the paid write and the marker clear were split. */
const paidButMarkerStillSet = (row: OrderRow): OrderRow => ({
  ...row,
  payment_status: 'paid',
});

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * A row as the flow would actually produce it. `payment_initiated_at` is set by
 * the client at step 1 of the checkout sequence and only for online payments
 * (design.md §1b), so the marker tracks `created_at` for online methods and is
 * NULL for COD/cash. `legacyRow` covers rows created before the marker column
 * existed, which is every row in the database today.
 */
const orderRow = (opts: {
  paymentStatus?: readonly string[];
  status?: readonly string[];
  paymentMethod?: readonly string[];
  ageMinutes?: { min: number; max: number };
  /** force the marker present (true) or absent (false); default: generate both */
  marker?: boolean;
}): fc.Arbitrary<OrderRow> =>
  fc
    .record({
      payment_status: fc.constantFrom(...(opts.paymentStatus ?? PAYMENT_STATUSES)),
      status: fc.constantFrom(...(opts.status ?? ORDER_STATUSES)),
      payment_method: fc.constantFrom(...(opts.paymentMethod ?? PAYMENT_METHODS)),
      age: fc.integer(opts.ageMinutes ?? { min: 0, max: 240 }),
      legacyRow: opts.marker === undefined ? fc.boolean() : fc.constant(!opts.marker),
    })
    .map(({ payment_status, status, payment_method, age, legacyRow }) => {
      const takesMoneyOnline = (ONLINE_METHODS as readonly string[]).includes(payment_method);
      return {
        payment_status,
        status,
        payment_method,
        created_at_age: age,
        payment_initiated_at_age: takesMoneyOnline && !legacyRow ? age : null,
      };
    });

const FC = { numRuns: 500 };

// ---------------------------------------------------------------------------
// Extraction evidence — passes before and after the fix
// ---------------------------------------------------------------------------

describe('cleanup predicate — extraction (no database required)', () => {
  it('extracted the delete predicate from the committed migration', () => {
    // Sanity check on the extractor, so a finding below reads as "the predicate
    // says this" rather than "the parser produced nothing".
    expect(predicate.migrationFile).toMatch(/\.sql$/);
    expect(predicate.conditions.length).toBeGreaterThan(0);
    expect(predicate.window).not.toBeNull();
    // Every condition compiled; none was skipped or approximated.
    expect(predicate.conditions.map((c) => c.source).join(' AND ').replace(/\s+/g, ' ')).toBe(
      predicate.whereClause.replace(/\s+/g, ' ')
    );

    console.log(
      `[task 5] predicate under test, from supabase/migrations/${predicate.migrationFile}:\n` +
        `  WHERE ${predicate.whereClause}\n` +
        `  age threshold: ${predicate.window!.minutes} minute(s) on ${predicate.window!.column}\n` +
        `  pg_cron period: ${predicate.cronPeriodMinutes ?? 'not declared here'} minute(s)`
    );
  });

  it('records the deletion window against the period of the job that applies it', () => {
    // Evidence, not an assertion about correctness: a row is not deleted the
    // instant it crosses the threshold, but on the next scheduled run. The
    // reachable deletion age therefore spans [window, window + period], which
    // is what makes a 5-minute window under a 5-minute schedule able to reach
    // a 6-minute-old row. Recorded here; asserted by the in-flight property.
    expect(predicate.window!.minutes).toBeGreaterThan(0);
    if (predicate.cronPeriodMinutes !== null) {
      expect(predicate.cronPeriodMinutes).toBeGreaterThan(0);
      console.log(
        `[task 5] reachable deletion age: ${predicate.window!.minutes}-` +
          `${predicate.window!.minutes + predicate.cronPeriodMinutes} minutes ` +
          `(window ${predicate.window!.minutes}m, schedule every ${predicate.cronPeriodMinutes}m)`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Property 4 over the extracted predicate — the four universally quantified
// halves, plus the interleaving one
// ---------------------------------------------------------------------------

describe('Property 4 — cleanup never deletes an in-flight or paid order (model)', () => {
  it('spares every paid order, whatever its age, status or method', () => {
    // Preserved baseline: expected to pass on the unfixed predicate too.
    fc.assert(
      fc.property(orderRow({ paymentStatus: ['paid'] }), (row) => {
        expect(verdict(row)).toMatch(SPARED);
      }),
      FC
    );
  });

  it('spares every order whose payment is not taken online (COD and cash)', () => {
    // Preserved baseline: expected to pass on the unfixed predicate too.
    fc.assert(
      fc.property(orderRow({ paymentMethod: OFFLINE_METHODS }), (row) => {
        expect(verdict(row)).toMatch(SPARED);
      }),
      FC
    );
  });

  it('spares every in-flight online order inside the grace window', () => {
    // COUNTEREXAMPLE 1 — expected to FAIL on the unfixed predicate.
    // In-flight means: money is being taken online, the order is still pending,
    // and payment was initiated less than GRACE_WINDOW_MINUTES ago. Clause 3.6
    // forbids deleting these. `status` is generated freely because the field is
    // an unrelated lifecycle marker and cleanup has no business reading it.
    fc.assert(
      fc.property(
        orderRow({
          paymentStatus: ['pending'],
          paymentMethod: ONLINE_METHODS,
          ageMinutes: { min: 0, max: GRACE_WINDOW_MINUTES },
        }),
        (row) => {
          expect(verdict(row)).toMatch(SPARED);
        }
      ),
      FC
    );
  });

  it('reclaims every abandoned online order past the grace window', () => {
    // COUNTEREXAMPLE 2 — expected to FAIL on the unfixed predicate.
    // The other direction of clause 3.6: stale unpaid orders must still be
    // removed. Scoped to rows carrying the in-flight marker, i.e. rows the new
    // flow created; legacy marker-less rows are outside the reclaim set by
    // design and are recorded as an open item instead.
    fc.assert(
      fc.property(
        orderRow({
          paymentStatus: ['pending'],
          paymentMethod: ONLINE_METHODS,
          ageMinutes: { min: GRACE_WINDOW_MINUTES + 1, max: 24 * 60 },
          marker: true,
        }),
        (row) => {
          expect(verdict(row)).toMatch(DELETED);
        }
      ),
      FC
    );
  });

  it('no interleaving of cleanup and the paid transition deletes a paid order', () => {
    // COUNTEREXAMPLE 3 — expected to FAIL on the unfixed predicate.
    // Both orderings are checked, because only one of them is about the row's
    // final state:
    //   A) the paid transition commits first, then cleanup evaluates — safe iff
    //      the paid row does not match.
    //   B) cleanup evaluates first, on the row as it stands mid-verification —
    //      safe iff an in-flight row cannot match at all. If it can, the row is
    //      deleted before the paid write lands and a captured payment is lost.
    // Ordering B is why the grace window has to exceed the worst-case
    // verification latency rather than merely be nonzero.
    fc.assert(
      fc.property(
        orderRow({
          paymentStatus: ['pending'],
          paymentMethod: ONLINE_METHODS,
          ageMinutes: { min: 0, max: GRACE_WINDOW_MINUTES },
          marker: true,
        }),
        (inFlight) => {
          expect({
            orderingA_paidThenCleanup: verdict(markOrderPaid(inFlight)),
            orderingB_cleanupThenPaid: verdict(inFlight),
            // Not reachable through mark_order_paid as designed, since it writes
            // both fields in one UPDATE. Asserted anyway so the property does
            // not silently depend on that atomicity.
            hypotheticalSplitWrite: verdict(paidButMarkerStillSet(inFlight)),
          }).toMatchObject({
            orderingA_paidThenCleanup: expect.stringMatching(SPARED),
            orderingB_cleanupThenPaid: expect.stringMatching(SPARED),
            hypotheticalSplitWrite: expect.stringMatching(SPARED),
          });
        }
      ),
      FC
    );
  });
});

// ---------------------------------------------------------------------------
// The concrete cases task 5 names, spelled out
// ---------------------------------------------------------------------------

describe('Property 4 — the concrete cases from task 5 (model)', () => {
  /** An online order created 6 minutes ago and still awaiting verification. */
  const inFlightSixMinutes = (status: string): OrderRow => ({
    payment_status: 'pending',
    status,
    // What `mapPaymentMethod('razorpay')` actually stores. See PAYMENT_METHODS.
    payment_method: 'online',
    created_at_age: 6,
    payment_initiated_at_age: 6,
  });

  it('an online pending order with status pending, created 6 minutes ago, survives cleanup', () => {
    expect(verdict(inFlightSixMinutes('pending'))).toMatch(SPARED);
  });

  it('an online pending order with status placed is reclaimed once it is abandoned', () => {
    // `'placed'` is what checkout writes. At 6 minutes it must survive; at 20 it
    // must be gone. The second half is the "never cleaned up either" mode.
    const inWindow = inFlightSixMinutes('placed');
    const abandoned: OrderRow = {
      ...inFlightSixMinutes('placed'),
      created_at_age: 20,
      payment_initiated_at_age: 20,
    };
    expect({
      atSixMinutes: verdict(inWindow),
      atTwentyMinutes: verdict(abandoned),
    }).toMatchObject({
      atSixMinutes: expect.stringMatching(SPARED),
      atTwentyMinutes: expect.stringMatching(DELETED),
    });
  });

  it('a paid order is never deleted', () => {
    const row: OrderRow = {
      payment_status: 'paid',
      status: 'placed',
      payment_method: 'online',
      created_at_age: 90,
      payment_initiated_at_age: null,
    };
    expect(verdict(row)).toMatch(SPARED);
  });

  it('a COD order is never deleted', () => {
    const row: OrderRow = {
      payment_status: 'pending',
      status: 'placed',
      // `mapPaymentMethod('cod')` stores `'cash'`; the AI order paths store `'cod'`.
      payment_method: 'cash',
      created_at_age: 60 * 24,
      payment_initiated_at_age: null,
    };
    const asCod: OrderRow = { ...row, payment_method: 'cod' };
    expect({ storedAsCash: verdict(row), storedAsCod: verdict(asCod) }).toMatchObject({
      storedAsCash: expect.stringMatching(SPARED),
      storedAsCod: expect.stringMatching(SPARED),
    });
  });
});

// ---------------------------------------------------------------------------
// EMPIRICAL HALF — real rows, the real function
// ---------------------------------------------------------------------------

type ProbeTarget = { url: string; anonKey: string; serviceRoleKey: string };

/** Production project ref, from `constants/config.ts:5`. Hard-blocked. */
const PRODUCTION_PROJECT_REF = 'xcpznnkpjgyrpbvpnvit';

const isLocalUrl = (url: string) =>
  /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:\d+)?/i.test(url);

/**
 * Returns the probe target, or a human-readable reason the empirical half cannot
 * run. Never throws — an absent database is an unmet precondition, and it must
 * not be mistaken for the bug being absent.
 */
function resolveProbeTarget(): { target: ProbeTarget } | { skipReason: string } {
  const url = process.env.PROBE_SUPABASE_URL;
  const anonKey = process.env.PROBE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.PROBE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    return {
      skipReason:
        'PROBE_SUPABASE_URL is not set. Start a local stack with `supabase start` (needs Docker) ' +
        'or provision a branch database, then set PROBE_SUPABASE_URL, PROBE_SUPABASE_ANON_KEY ' +
        'and PROBE_SUPABASE_SERVICE_ROLE_KEY.',
    };
  }
  if (url.includes(PRODUCTION_PROJECT_REF)) {
    return {
      skipReason:
        `PROBE_SUPABASE_URL points at the production project (${PRODUCTION_PROJECT_REF}). ` +
        'This probe runs cleanup_pending_orders(), which DELETES rows. Refusing.',
    };
  }
  if (!isLocalUrl(url) && process.env.PROBE_ALLOW_REMOTE !== 'yes') {
    return {
      skipReason:
        `PROBE_SUPABASE_URL (${url}) is not local. If it really is a throwaway branch database, ` +
        'set PROBE_ALLOW_REMOTE=yes to confirm. Refusing by default.',
    };
  }
  if (!anonKey || !serviceRoleKey) {
    return {
      skipReason:
        'PROBE_SUPABASE_ANON_KEY and/or PROBE_SUPABASE_SERVICE_ROLE_KEY are not set. The ' +
        'service-role key seeds the rows and invokes the cleanup RPC, which is granted to ' +
        'service_role only.',
    };
  }
  return { target: { url, anonKey, serviceRoleKey } };
}

const resolution = resolveProbeTarget();
const empiricalTarget = 'target' in resolution ? resolution.target : null;
const empiricalSkipReason = 'skipReason' in resolution ? resolution.skipReason : null;

describe('Property 4 — empirical probe against a real database', () => {
  it('records why the empirical half did or did not run', () => {
    if (empiricalTarget) {
      expect(empiricalTarget.url).toBeTruthy();
      return;
    }
    console.warn(
      `[task 5] Empirical cleanup probe SKIPPED — NOT a pass and NOT a refutation.\n` +
        `Reason: ${empiricalSkipReason}\n` +
        `The model half of this suite extracts the real predicate from ` +
        `supabase/migrations/${predicate.migrationFile} and still carries the finding. ` +
        `To run the empirical half see the header of this file, or ` +
        `supabase/probes/cleanup_pending_orders_probe.sql for the psql equivalent.`
    );
    expect(empiricalSkipReason).toBeTruthy();
  });

  const maybe = empiricalTarget ? describe : describe.skip;

  maybe('seeded rows through the real cleanup_pending_orders()', () => {
    const target = empiricalTarget as ProbeTarget;
    const tag = `CLEANUP-PROBE-${Date.now()}`;

    let service: any;
    let userId = '';
    let hasMarkerColumn = false;
    /** order_number -> id, for the rows this probe seeded. */
    const seeded = new Map<string, string>();

    const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

    async function seed(
      label: string,
      row: { payment_status: string; status: string; payment_method: string; age: number }
    ): Promise<void> {
      const order_number = `${tag}-${label}`;
      const insert: Record<string, unknown> = {
        order_number,
        seller_id: userId,
        user_id: userId,
        total_amount: 100,
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        status: row.status,
        created_at: minutesAgo(row.age),
      };
      if (hasMarkerColumn) insert.payment_initiated_at = minutesAgo(row.age);
      const { data, error } = await service.from('orders').insert(insert).select('id').single();
      if (error) throw new Error(`seeding ${label} failed: ${error.message}`);
      seeded.set(label, data.id);
    }

    const survived = async (label: string): Promise<boolean> => {
      const { data } = await service
        .from('orders')
        .select('id')
        .eq('id', seeded.get(label))
        .maybeSingle();
      return !!data;
    };

    beforeAll(async () => {
      const { createClient } = require('@supabase/supabase-js');
      service = createClient(target.url, target.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const created = await service.auth.admin.createUser({
        email: `cleanup-probe+${Date.now()}@example.invalid`,
        password: `Probe!${Math.random().toString(36).slice(2)}Aa1`,
        email_confirm: true,
      });
      if (created.error) throw created.error;
      userId = created.data.user.id;

      const profile = await service.from('profiles').insert({
        id: userId,
        phone_number: `+9198${Date.now().toString().slice(-8)}`,
        role: 'retailer',
      });
      if (profile.error) throw profile.error;

      // The marker column only exists once task 11.1 has landed. Detect rather
      // than assume, so the same probe runs on both schemas.
      const marker = await service.from('orders').select('payment_initiated_at').limit(1);
      hasMarkerColumn = !marker.error;
      console.log(
        `[task 5] empirical probe: orders.payment_initiated_at ` +
          `${hasMarkerColumn ? 'present' : 'absent (pre-task-11.1 schema)'}`
      );

      await seed('inflight-status-pending', {
        payment_status: 'pending',
        status: 'pending',
        payment_method: 'online',
        age: 6,
      });
      await seed('inflight-status-placed', {
        payment_status: 'pending',
        status: 'placed',
        payment_method: 'online',
        age: 6,
      });
      await seed('abandoned-status-placed', {
        payment_status: 'pending',
        status: 'placed',
        payment_method: 'online',
        age: 20,
      });
      await seed('paid', {
        payment_status: 'paid',
        status: 'placed',
        payment_method: 'online',
        age: 90,
      });
      await seed('cod', {
        payment_status: 'pending',
        status: 'placed',
        payment_method: 'cash',
        age: 90,
      });
      // For the interleaving case: in-flight now, marked paid after cleanup runs.
      await seed('interleaved', {
        payment_status: 'pending',
        status: 'pending',
        payment_method: 'online',
        age: 6,
      });

      const { error } = await service.rpc(CLEANUP_FUNCTION);
      if (error) throw new Error(`${CLEANUP_FUNCTION}() failed: ${error.message}`);
    }, 120000);

    afterAll(async () => {
      if (!service) return;
      await service.from('orders').delete().like('order_number', `${tag}%`);
      if (userId) {
        await service.from('orders').delete().eq('user_id', userId);
        await service.from('profiles').delete().eq('id', userId);
        await service.auth.admin.deleteUser(userId);
      }
    }, 120000);

    it('spares an in-flight online order with status pending', async () => {
      expect(await survived('inflight-status-pending')).toBe(true);
    }, 30000);

    it('spares an in-flight online order with status placed', async () => {
      expect(await survived('inflight-status-placed')).toBe(true);
    }, 30000);

    it('reclaims an abandoned online order past the grace window', async () => {
      expect(await survived('abandoned-status-placed')).toBe(false);
    }, 30000);

    it('spares a paid order', async () => {
      expect(await survived('paid')).toBe(true);
    }, 30000);

    it('spares a COD order', async () => {
      expect(await survived('cod')).toBe(true);
    }, 30000);

    it('cleanup running before the paid transition does not lose the payment', async () => {
      // Ordering B from the model property, empirically: cleanup already ran in
      // beforeAll. If the row is gone, the paid write below has nothing to
      // update and a captured payment is lost.
      expect(await survived('interleaved')).toBe(true);

      const update: Record<string, unknown> = { payment_status: 'paid' };
      if (hasMarkerColumn) update.payment_initiated_at = null;
      const { data, error } = await service
        .from('orders')
        .update(update)
        .eq('id', seeded.get('interleaved'))
        .select('id, payment_status');
      expect(error).toBeNull();
      expect(data?.[0]?.payment_status).toBe('paid');

      // And the reverse ordering: now that it is paid, another cleanup run
      // must leave it alone.
      const again = await service.rpc(CLEANUP_FUNCTION);
      expect(again.error).toBeNull();
      expect(await survived('interleaved')).toBe(true);
    }, 60000);
  });
});
