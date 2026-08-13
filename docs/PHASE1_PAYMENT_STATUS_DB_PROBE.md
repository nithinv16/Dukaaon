# Phase 1 — database authority over `payment_status` (bug-condition probe)

Recorded by task 3 of `.kiro/specs/critical-security-and-error-fixes`.

Property under test: **Property 1 — Paid State Requires Server-Verified Signature**,
database-level half (design.md). Bugfix clauses **1.20 / 2.20**.

Task 2 proved the *client* authors paid state. This task asks the independent
question: if the client were fixed, would anything in the database still stop a
user's own credentials from writing `payment_status = 'paid'`?

**Answer: no. Finding CONFIRMED — statically. The empirical half has not been run;
it needs a database.**

## Verdict at a glance

| Half | Status | What it establishes |
| --- | --- | --- |
| Static analysis of the committed schema | **RUN. Confirms the finding.** | No trigger, no security-definer writer, no column-constraining RLS policy, no column privilege anywhere in `supabase/migrations/**` or `sql/**` governs *who* may write `payment_status`. |
| Empirical writes under a real user JWT | **NOT RUN — no database reachable.** | Would confirm the same thing against a running instance, including any schema drift the committed files do not show. |

The distinction matters because of a drift risk the design already flagged and
task 10 is scheduled to resolve: the committed migrations and the running
database appear to have diverged. Static analysis proves the *committed* schema
has no authority over `payment_status`. It cannot prove the live database has
none. **Task 10 or task 11.5 must run the empirical half before the trigger in
task 11.1 is treated as verified.**

## Artifacts

| Artifact | Purpose |
| --- | --- |
| `tests/payments/paymentStatusAuthority.dbProbe.test.ts` | The runnable probe. Static half always runs; empirical half skips with a printed reason when no database is configured. |
| `supabase/probes/payment_status_authority_probe.sql` | The same probe as a `psql` script, for operators with direct database access rather than a REST endpoint. Never run. |

Command: `npx jest tests/payments/paymentStatusAuthority.dbProbe.test.ts`

Result on the unfixed tree: **11 tests — 3 failed, 4 passed, 4 skipped.** The
three failures are the finding. The four passes are the evidence and the
analyser's own sanity checks. The four skips are the empirical half.

```
✓ found the committed schema to analyse
✓ positive control: the only committed control over payment_status is a CHECK on values
✓ evidence: the write policies on orders and master_orders are row-scoped only
✕ orders: the database holds authority over who may write payment_status
✕ master_orders: the database holds authority over who may write payment_status
✕ a security-definer function owns the paid transition
✓ records why the empirical half did or did not run
○ skipped  rejects UPDATE orders SET payment_status = paid
○ skipped  rejects UPDATE master_orders SET payment_status = paid
○ skipped  rejects INSERT INTO orders with payment_status = paid
○ skipped  still allows INSERT INTO orders at payment_status = pending (COD path)
```

## Why the empirical half could not run

No database was reachable from this machine, and the spec forbids touching
production:

- No Docker, Colima, Podman or OrbStack, so `supabase start` cannot bring up a
  local stack. (`npx supabase` itself resolves fine at 2.113.0.)
- No `psql` client and no local Postgres.
- No branch database was provisioned and no credentials for one exist in the
  environment. The only `.env` file in the tree is `.env.example`.

Nothing was fabricated in place of the missing run. The probe skips loudly:

```
[task 3] Empirical DB probe SKIPPED — NOT a pass and NOT a refutation.
Reason: PROBE_SUPABASE_URL is not set. ...
The static half of this suite still confirms the finding.
```

An unavailable database is an unmet precondition, not evidence that the bug is
absent. The probe says so in the output so a later reader cannot misread the
skip as a pass.

### To run it

Local:

```bash
supabase start                       # needs Docker
export PROBE_SUPABASE_URL=http://127.0.0.1:54321
export PROBE_SUPABASE_ANON_KEY=<anon key from `supabase status`>
export PROBE_SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`>
npx jest tests/payments/paymentStatusAuthority.dbProbe.test.ts
```

Branch database: same, plus `PROBE_ALLOW_REMOTE=yes` to confirm the target is
throwaway. The production project ref (`xcpznnkpjgyrpbvpnvit`, from
`constants/config.ts:5`) is hard-blocked in the probe and cannot be overridden
by an env var.

Direct database access instead of REST:

```bash
psql "<local-or-branch-db-url>" -v ON_ERROR_STOP=0 \
  -f supabase/probes/payment_status_authority_probe.sql
```

## Counterexamples (static)

### 1. No trigger gates `payment_status` on `orders`

Six triggers exist on `orders` across the committed SQL. Not one of them
inspects `payment_status`, and the only `BEFORE` one assigns an order number:

```
BEFORE INSERT          -> set_order_number            (supabase/migrations/20250105000000_create_orders.sql)
AFTER  UPDATE          -> update_stock_on_order_confirm (supabase/migrations/20250105000000_create_orders.sql)
AFTER  INSERT OR UPDATE-> update_customer_stats       (supabase/migrations/20250106000000_create_triggers.sql)
AFTER  INSERT          -> track_purchase_history      (supabase/migrations/20250113_purchase_tracking_personalization.sql)
AFTER  INSERT          -> track_purchase_history      (supabase/migrations/20251206000001_fix_purchase_tracking_trigger.sql)
AFTER  INSERT OR UPDATE-> update_customer_stats       (sql/create_customers_table.sql)

gatingPaymentStatus: []
```

An `AFTER` trigger could not reject the write anyway. `update_stock_on_order_confirm`
keys on `status`, not `payment_status`.

### 2. No trigger gates `payment_status` on `master_orders`

One trigger exists, and it touches a timestamp:

```
BEFORE UPDATE -> update_updated_at_column (sql/master_order_system.sql)

gatingPaymentStatus: []
```

Note the file: `sql/`, not `supabase/migrations/`. The `master_orders` trigger
was never migrated, only scripted. Whether it is present live is exactly the
kind of thing only the empirical half can answer.

### 3. No security-definer function owns the paid transition

```
securityDefinerPaidWriters: []
```

No function anywhere in the tree assigns `payment_status = 'paid'`. `mark_order_paid`
does not exist yet — grepping the whole repo (`supabase`, `sql`, `app`,
`services`, `components`) returns nothing. The only writers of `'paid'` are in
client code:

```
app/(main)/checkout/index.tsx:247   payment_status: 'paid',   // multi-seller
app/(main)/checkout/index.tsx:321   payment_status: 'paid',   // single-seller
```

### 4. No column-level privilege narrows the column

```
columnPrivilegeStatements: []
```

There is no `GRANT`/`REVOKE` naming `payment_status` anywhere. (The design is
right that a column-level `REVOKE INSERT (payment_status)` would be the wrong
fix regardless: it fails *any* insert naming the column, including the COD path
that legitimately writes `'pending'` at `checkout/index.tsx:136`, which would
break clause 3.1.)

## Evidence: what the existing controls actually do

These two probes **pass**, before and after the fix. They are what makes the
three failures above meaningful.

### The only control is a CHECK on allowed values

```sql
-- supabase/migrations/20250105000000_create_orders.sql:26
payment_status TEXT DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue'))

-- supabase/migrations/20250126000004_create_master_orders_system.sql:22
payment_status VARCHAR(50) DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'))
```

`'paid'` is in both allowlists. The constraint governs the **value**; it admits
that value from **anyone** who can write the row at all. That gap is clause 1.20
in one line.

### The write policies are row-scoped only

RLS is enabled on both tables. Every write policy decides which *row* a caller
may touch and says nothing about which *values* they may set:

```sql
-- orders
CREATE POLICY "Sellers can insert their own orders"        FOR INSERT WITH CHECK (seller_id = auth.uid());
CREATE POLICY "Sellers can update their own orders"        FOR UPDATE USING      (seller_id = auth.uid());
CREATE POLICY "Users can insert orders with their user_id" FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own orders by user_id" FOR UPDATE USING    (auth.uid() = user_id);

-- master_orders
CREATE POLICY "Users can insert their own master orders"   FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own master orders"   FOR UPDATE USING      (auth.uid() = user_id);
```

Two details sharpen this:

1. **Neither `UPDATE` policy has a `WITH CHECK` clause.** Postgres then reuses
   the `USING` expression for the post-update row, so ownership is re-checked
   and the column is not. A user updating their own order to `payment_status =
   'paid'` satisfies the policy completely.
2. **The `INSERT` policies gate `user_id` / `seller_id` only.** An insert
   already at `'paid'` satisfies them, which is exactly what
   `checkout/index.tsx:321` does today.

This is also the justification for the mechanism task 11.1 picks. RLS `WITH
CHECK` cannot express "every column except this one", so making these policies
column-aware would mean duplicating the payment predicate into all four of them
— high regression risk on the seller flows, which is why the design chose a
trigger instead. **The passing evidence probe stays passing after the fix**,
because task 11.1 adds no policy.

## Justification for the task 8 / 11.1 trigger

The chain is now closed on both sides:

- **Client side (task 2):** paid state is written by the device before any HMAC
  is checked, and the verification verdict is discarded.
- **Database side (this task):** nothing at the database level would stop it
  even if the client were fixed. A correct client would be one refactor away
  from regressing, and any caller holding the public anon key plus any user's
  JWT can set `payment_status = 'paid'` on their own orders directly, bypassing
  the app entirely.

Fixing only the client would leave the second hole open. That is the argument
for `enforce_payment_status_authority()` plus `mark_order_paid()` in task 11.1.

## The probe is falsifiable

A bug-condition probe that can never go green is worthless for verifying the
fix, so this was checked rather than assumed. A sketch of the task 11.1
migration (the `enforce_payment_status_authority` trigger on both tables plus a
`SECURITY DEFINER mark_order_paid`) was added to `supabase/migrations/`
temporarily, and all three failing assertions flipped to passing with the four
evidence assertions still passing. The sketch was then deleted; the tree is
unchanged. The assertions are deliberately **mechanism-agnostic** — a gating
trigger, a column-constraining RLS `WITH CHECK`, or a column-level privilege all
satisfy them — so the probe validates the property, not the design's choice of
implementation.

Two analyser heuristics were tightened during that check, because both produced
false passes that would have understated the finding:

- Function bodies are now cut at the dollar-quote terminator, so one function's
  body cannot bleed into the next statement.
- "Owns the paid transition" requires an actual `payment_status = 'paid'`
  assignment, not merely a function mentioning both tokens. Under the looser
  rule an unrelated function in `sql/stock_delivery_bookings.sql` matched and
  the probe passed when it should have failed.

## Effect on the verification baseline

Compared with `docs/VERIFICATION_BASELINE.md` and the task 2 delta:

- `npm test`: **52 suites** (was 51), **648 tests** (was 637), **629 passing**
  (was 625 — the 4 new passes are this file's evidence and sanity probes),
  **15 failing** (was 12: 5 pre-existing + 7 from task 2 + **3 deliberate here**),
  4 skipped (was 0 — this file's empirical half).
- `npm run typecheck`: **632 errors — unchanged.** `tests/**` is excluded from
  the typecheck scope; the new file was type-checked separately and is clean.

The 3 failures here are expected and must stay failing until task 11.1 lands.
They are not a regression.

## Open item for task 11.5

Re-running this file is not sufficient on its own. Task 11.5 must **also run the
empirical half** against a branch database and confirm all three writes are
rejected with SQLSTATE `42501` (`insufficient_privilege`), plus the fourth
empirical case — that an insert at `payment_status = 'pending'` still succeeds,
which is the COD path in clause 3.1. The static half passing only proves the
migration is committed, not that it is applied and behaves.
