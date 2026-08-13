# Schema Findings — Task 10

Recorded by task 10 of `.kiro/specs/critical-security-and-error-fixes`.

**Purpose**: Confirm the live schema before writing the `payment_status` trigger
migration (task 11.1). The design flagged migration drift: the committed
migrations and the running database appear to have diverged. The trigger must be
designed and tested against the **live** schema, not the reconstructed one.

**Date**: 2025-07-12
**Method**: Static analysis of committed migrations + live API probing via
Supabase REST API (`xcpznnkpjgyrpbvpnvit.supabase.co`).

---

## 1. CHECK Constraints on `orders.status`

### Committed migration (20251003112500_update_orders_status_constraint.sql)

```sql
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check CHECK (
  status IN (
    'draft', 'pending', 'confirmed', 'preparing', 'ready',
    'accepted', 'processing', 'picked_up', 'in_transit',
    'out_for_delivery', 'shipped', 'delivered', 'cancelled',
    'completed', 'rejected'
  )
);
```

**`'placed'` is NOT in this list.**

### What the app actually writes

| Source | Value written | Notes |
| --- | --- | --- |
| `app/(main)/checkout/index.tsx:139` (COD) | `status: 'placed'` | COD orders |
| `app/(main)/checkout/index.tsx:248` (multi-seller) | `status: 'placed'` | Online multi-seller |
| `app/(main)/checkout/index.tsx:320` (single-seller) | `status: 'placed'` | Online single-seller |
| `services/aiOrderPlacement.ts:63` | `status: 'pending'` | AI orders |

### Drift verdict

**CONFIRMED: the live CHECK constraint differs from the committed migration.**

The app inserts `status: 'placed'` on every checkout path and the app works.
If the committed constraint were enforced live, every checkout would fail with
`23514 (check_violation)`. Therefore the live database either:
- Has `'placed'` added to the constraint, OR
- Has the `orders_status_check` constraint dropped entirely

Since we cannot query `pg_constraint` via anon key, and the Supabase CLI cannot
link to this project (different org), the exact live state is inferred from the
app's behaviour.

**For the trigger migration**: the trigger must NOT assume any particular set of
`status` values. It gates `payment_status` changes, not `status` changes. The
trigger's predicate should fire on `payment_status` writes only, leaving
`status` completely untouched.

---

## 2. CHECK Constraints on `orders.payment_status`

### Committed migration (20250105000000_create_orders.sql, line 26)

```sql
payment_status TEXT DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue'))
```

**`'not_paid'` is NOT in this list.**

### What the app actually writes

| Source | Value written | Notes |
| --- | --- | --- |
| `app/(main)/checkout/index.tsx:139` (COD) | `'pending'` | In the list |
| `app/(main)/checkout/index.tsx:248` (multi-seller) | `'paid'` | In the list |
| `app/(main)/checkout/index.tsx:321` (single-seller) | `'paid'` | In the list |
| `services/aiOrderPlacement.ts:65` (non-COD) | `'not_paid'` | NOT in the list |
| `services/aiOrderPlacement.ts:65` (COD) | `'pending'` | In the list |

### Drift verdict

**CONFIRMED: if the committed CHECK existed live as written, the AI order
placement path would fail for non-COD payment methods.**

Two possibilities:
1. The constraint was expanded live to include `'not_paid'`, or
2. The AI order placement path for non-COD orders is broken today (plausible
   since AI ordering currently defaults to COD — see
   `services/aiAgent/bedrockAIService.ts:2530` which defaults `paymentMethod`
   to `'cod'`, meaning the `'not_paid'` branch may never execute in practice)

**Decision for `'not_paid'` handling**: see [section 7](#7-decision-not_paid-handling) below.

---

## 3. CHECK Constraints on `master_orders.payment_status`

### Committed migration (20250126000004_create_master_orders_system.sql, line 22)

```sql
payment_status VARCHAR(50) DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'))
```

**`'not_paid'` is NOT in this list.** No code path writes `'not_paid'` to
`master_orders`.

The multi-seller checkout in `checkout/index.tsx` does not explicitly set
`payment_status` on the master order — it relies on the `create_master_order`
RPC which inserts with the column default `'pending'`. The individual orders
under it get `payment_status: 'paid'` set by the client (this is the bug
condition, not a schema issue).

---

## 4. `payment_transactions.transaction_id` — Unique Index

### Committed migrations

There is **no committed migration creating the `payment_transactions` table**.
The table exists live (confirmed via API: `SELECT *` returns `[]` not an error),
but its creation happened outside the committed migration path — likely via
Supabase dashboard SQL editor or a script that was not saved to the repo.

The migration `20250120000002_update_payment_transactions_constraint.sql`
modifies a constraint on the table (guarded by an existence check), confirming
the table was expected to pre-exist.

### Columns confirmed live (via REST API probing)

| Column | Confirmed | Method |
| --- | --- | --- |
| `id` | Yes | `?select=id` returns `[]` not error |
| `order_id` | Yes | `?select=order_id` returns `[]` |
| `amount` | Yes | `?select=amount` returns `[]` |
| `status` | Yes | `?select=status` returns `[]` |
| `transaction_id` | Yes | `?select=transaction_id` returns `[]` |
| `payment_method` | Yes | `?select=payment_method` returns `[]` |
| `created_at` | Yes | `?select=created_at` returns `[]` |
| `updated_at` | Yes | `?select=updated_at` returns `[]` |
| `user_id` | **No** | Returns `42703` error |

### Unique index on `transaction_id`

**UNKNOWN — cannot be determined via anon key.** There is no committed migration
adding a unique index on `payment_transactions.transaction_id`. The only index
on `transaction_id` in the entire committed migrations is on
`credit_payment_history.transaction_id` (partial index,
`20251129100003_create_credit_payment_history.sql`).

**Recommendation for task 11.1**: The migration MUST add a unique index on
`payment_transactions.transaction_id` (with `IF NOT EXISTS` or `CREATE UNIQUE
INDEX ... ON CONFLICT DO NOTHING` guard) before using `ON CONFLICT
(transaction_id) DO NOTHING`. If one already exists live, the `IF NOT EXISTS`
is a no-op. If it doesn't exist, the migration creates it. Either way the
`mark_order_paid` function works.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id
  ON public.payment_transactions (transaction_id)
  WHERE transaction_id IS NOT NULL;
```

---

## 5. `payment_initiated_at` Column

### `orders.payment_initiated_at`

**Does NOT exist.** Confirmed live via REST API:

```
GET /rest/v1/orders?select=payment_initiated_at&limit=1
→ {"code":"42703","message":"column orders.payment_initiated_at does not exist"}
```

### `master_orders.payment_initiated_at`

**Does NOT exist.** Confirmed live via REST API:

```
GET /rest/v1/master_orders?select=payment_initiated_at&limit=1
→ {"code":"42703","message":"column master_orders.payment_initiated_at does not exist"}
```

**For task 11.1**: The migration must ADD this column to both tables.

---

## 6. Additional Schema Drift Observations

### Columns on `orders` not in the committed CREATE TABLE

The checkout code inserts these columns that are NOT in
`20250105000000_create_orders.sql`:

| Column | Used in | Committed migration adding it? |
| --- | --- | --- |
| `user_id` | checkout, AI orders | Yes — `20250126000002_add_user_id_to_orders.sql` |
| `master_order_id` | multi-seller checkout | Yes — `20250126000004_create_master_orders_system.sql` |
| `items` (JSONB) | checkout | **No** — not in any committed migration |
| `delivery_fee` | checkout | **No** — not in any committed migration |
| `seller_ids` (array) | AI orders | **No** — not in any committed migration |
| `is_ai_order` | AI orders | Yes — `20250117000000_add_ai_order_flag.sql` |

All three unmarked columns (`items`, `delivery_fee`, `seller_ids`) exist live
(confirmed via API: queries selecting them return `[]` not errors) but were
added outside the committed migration path.

**Impact on task 11.1**: None. The trigger only inspects `payment_status` and
the caller identity. It does not need to know about `items`, `delivery_fee`,
or `seller_ids`.

---

## 7. Decision: `'not_paid'` Handling

### Context

`services/aiOrderPlacement.ts:65` writes `payment_status: 'not_paid'` for
non-COD AI orders. This value:
- Is NOT in the committed `orders.payment_status` CHECK constraint
- Is only written by one code path (AI order placement, non-COD)
- That code path likely never executes in production today (the AI service
  defaults `paymentMethod` to `'cod'`, so the `'not_paid'` branch is dead)
- Has unclear semantics: it appears to mean "awaiting payment" which is
  functionally identical to `'pending'`

### Decision: **Normalize `'not_paid'` to `'pending'`**

Rationale:
1. The trigger's predicate needs to be simple: reject any `payment_status`
   write to `'paid'` from a non-privileged caller. `'not_paid'` is not the
   dangerous value; `'paid'` is.
2. `'not_paid'` adds no information over `'pending'` — both mean "not yet
   paid". Having two values for the same state creates ambiguity.
3. The AI order placement path should be fixed to write `'pending'` instead
   of `'not_paid'` as part of task 11.3 (when the checkout sequence is
   rewritten). This is a one-line change.
4. If a CHECK constraint on `payment_status` exists live that includes
   `'not_paid'`, the trigger's logic is unaffected — it only cares about
   transitions **to** `'paid'`, not about the full value set.

**Trigger predicate implication**: The `enforce_payment_status_authority`
trigger rejects writes where:
- `NEW.payment_status = 'paid'` (the dangerous transition)
- AND the caller is not privileged (`current_user NOT IN ('postgres',
  'supabase_admin', 'service_role')`)

It does NOT need to enumerate all valid non-paid values. Any value that is not
`'paid'` is allowed from any caller (subject to the existing CHECK constraint).
This means `'not_paid'`, `'pending'`, `'partial'`, `'overdue'`, `'failed'`,
`'refunded'` are all allowed from authenticated users — only `'paid'` requires
the privileged path through `mark_order_paid()`.

**Cleanup action (part of task 11.3)**: Change
`services/aiOrderPlacement.ts:65` from:
```typescript
payment_status: paymentMethod === 'cod' ? 'pending' : 'not_paid',
```
to:
```typescript
payment_status: 'pending',
```
This is safe because: the new flow creates all orders at `'pending'` and only
`mark_order_paid` transitions them to `'paid'`.

---

## 8. Summary Table for Task 11.1 Migration

| Question | Answer | Action for migration |
| --- | --- | --- |
| Does `'placed'` pass the live `orders.status` CHECK? | Yes (app works) | Trigger ignores `status` entirely |
| Does `'not_paid'` pass the live `orders.payment_status` CHECK? | Uncertain but irrelevant | Trigger only gates `→ 'paid'`; normalize to `'pending'` in task 11.3 |
| Does `payment_transactions.transaction_id` have a unique index? | Unknown, assume NO | Migration adds `CREATE UNIQUE INDEX IF NOT EXISTS` |
| Does `orders.payment_initiated_at` exist? | **No** (confirmed live) | Migration adds it |
| Does `master_orders.payment_initiated_at` exist? | **No** (confirmed live) | Migration adds it |
| What columns does `payment_transactions` have? | id, order_id, amount, status, transaction_id, payment_method, created_at, updated_at | `mark_order_paid` inserts into these columns |
| Is there any existing trigger on `payment_status`? | **No** (confirmed by static analysis, task 3) | Migration creates the first one |
| Is there an existing `mark_order_paid` function? | **No** (confirmed by static analysis, task 3) | Migration creates it |

---

## 9. Known Residual Drift (Out of Scope)

The following drift facts are pre-existing and out of scope for this fix. They
are recorded here so they are not mistaken for regressions introduced by the
trigger migration:

1. `orders.items`, `orders.delivery_fee`, `orders.seller_ids` — columns added
   outside committed migrations
2. `payment_transactions` table — created outside committed migrations
3. `orders.status` CHECK constraint — likely modified or dropped live to
   include `'placed'`
4. `orders.payment_status` CHECK constraint — may have been modified live to
   include `'not_paid'` (or the path that writes it is dead)
5. The `master_orders` updated_at trigger is in `sql/master_order_system.sql`
   (not a migration) — may or may not be present live

None of these affect the trigger design. The trigger gates a single value
transition (`→ 'paid'`) by caller identity, independent of all other columns
and constraints.
