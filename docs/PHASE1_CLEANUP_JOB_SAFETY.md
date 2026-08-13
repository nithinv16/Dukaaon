# Phase 1 — cleanup job safety (bug-condition counterexamples)

Recorded by task 5 of `.kiro/specs/critical-security-and-error-fixes`.

Property under test: **Property 4 — Cleanup Never Deletes an In-Flight or Paid Order**
(design.md). Bugfix clauses **1.20 / 2.5 / 3.6**.

Test: `tests/payments/cleanupPendingOrders.bugCondition.property.test.ts`
Command: `npx jest tests/payments/cleanupPendingOrders.bugCondition.property.test.ts`

Result on the unfixed tree: **18 tests — 5 failed, 7 passed, 6 skipped.** The five failures
are the finding. Four of the passes are the preserved baseline and the extraction evidence;
one records why the empirical half did not run. The six skips are the empirical half.

The predicate under test is **wrong in both directions**, exactly as task 5 predicted, and a
third failure mode — the interleaving one — follows from the first.

## Verdict at a glance

| Question | Answer |
| --- | --- |
| Can cleanup delete an order mid-verification? | **Yes.** An online order 6 minutes old with `status = 'pending'` is deleted. Clause 3.6 forbids exactly this. |
| Is an abandoned order actually reclaimed? | **No, not one that checkout created.** The predicate requires `status = 'pending'`; checkout writes `'placed'`. Those rows are never cleaned, at any age. |
| Can an ordering of cleanup and the paid transition lose a payment? | **Yes.** If cleanup evaluates first, the row is gone before the paid write lands. |
| Is a paid order ever deleted? | **No.** Preserved baseline, passes today and must keep passing. |
| Is a COD order ever deleted? | **No.** Preserved baseline — though not for the reason the predicate suggests. See [corrections](#corrections-to-the-predictions). |
| How wide is the exposure today, before Phase 1? | **Almost nil, by accident.** After task 11.3 it becomes **every online order**. See [what the predicate actually matches today](#what-the-predicate-actually-matches-today). |

## What was verified empirically, and what was not

| Half | Status | What it establishes |
| --- | --- | --- |
| Model of the predicate **extracted** from the committed migration, evaluated with `fast-check` | **RUN. Carries the finding.** | A universally quantified result about the predicate's logic over the generated domain. Both defects are logic defects, so this is a real result about the shipped function, not a stand-in for one. |
| Empirical — seed rows, call the real `cleanup_pending_orders()`, see what survived | **NOT RUN — no database reachable.** | Would confirm the same against a running instance, and is the only half that can detect drift between the committed predicate and the applied one. |

Same split, and the same reason, as the task 3 probe. Nothing below was fabricated in place
of the missing run.

**The model half is stronger than a transcription would be**, and that distinction is the
reason this task could proceed without a database. The suite does not contain a copy of the
predicate. It parses `supabase/migrations/*.sql`, finds the **latest** migration defining
`cleanup_pending_orders`, extracts the `WHERE` clause of its `DELETE FROM orders`, compiles
each condition, and evaluates the result under SQL three-valued logic. It refuses to run
rather than approximate: an unrecognised condition, a top-level `OR`, or a `DELETE` with no
`WHERE` all throw. The extracted clause is asserted to reassemble into the original text, so
a silently dropped condition fails the extraction test rather than weakening every property
downstream.

Two consequences worth knowing:

- The predicate the suite reports is printed on every run, so a reader never has to trust
  this document about what was measured:

  ```
  [task 5] predicate under test, from supabase/migrations/20250128000000_cleanup_pending_orders.sql:
    WHERE payment_status = 'pending' AND status = 'pending'
      AND created_at < NOW() - INTERVAL '5 minutes'
      AND payment_method != 'cod' AND payment_method != 'cash'
    age threshold: 5 minute(s) on created_at
    pg_cron period: 5 minute(s)
  ```

- When task 12.1 adds `<ts>_cleanup_pending_orders_grace.sql`, the extractor picks it up
  automatically, because migration filenames sort in apply order and the last definition
  wins. Task 12.2 re-runs this file with no edit.

**What the model cannot tell you** is whether the committed migration is the one actually
applied. The design already flagged migration drift and task 10 is scheduled to resolve it —
and the drift is not hypothetical here: `checkout/index.tsx` writes `status = 'placed'`,
which is absent from the `orders_status_check` list in
`20251003112500_update_orders_status_constraint.sql`. Run the empirical half before treating
task 12.1 as verified.

### The grace window is a specification constant, not an extracted one

`GRACE_WINDOW_MINUTES = 15` in the test comes from design.md §1e and tasks.md 12.1. It is
deliberately **not** read out of the predicate. Deriving the window from the thing under
test would make every window-related property vacuously true for any predicate at all,
including the current one. If the chosen window ever changes, it changes in the design first
and in that constant second.

### Why the empirical half could not run

Unchanged from task 3, and re-verified: no Docker, Colima, Podman or OrbStack, so
`supabase start` cannot bring up a local stack; no `psql` and no local Postgres; no branch
database provisioned and no credentials for one in the environment. Production must not be
touched, and here that matters more than in task 3 — `cleanup_pending_orders()` **deletes
rows**, and it deletes every row matching its predicate, not only seeded ones.

The suite skips loudly rather than quietly passing:

```
[task 5] Empirical cleanup probe SKIPPED — NOT a pass and NOT a refutation.
Reason: PROBE_SUPABASE_URL is not set. ...
The model half of this suite extracts the real predicate from
supabase/migrations/20250128000000_cleanup_pending_orders.sql and still carries the finding.
```

#### To run it

```bash
supabase start                       # needs Docker
export PROBE_SUPABASE_URL=http://127.0.0.1:54321
export PROBE_SUPABASE_ANON_KEY=<anon key from `supabase status`>
export PROBE_SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`>
npx jest tests/payments/cleanupPendingOrders.bugCondition.property.test.ts
```

Branch database: same, plus `PROBE_ALLOW_REMOTE=yes` to confirm the target is throwaway. The
production project ref (`xcpznnkpjgyrpbvpnvit`, from `constants/config.ts:5`) is hard-blocked
and cannot be overridden by an env var.

Direct database access instead of REST:

```bash
psql "<local-or-branch-db-url>" -v ON_ERROR_STOP=0 \
  -f supabase/probes/cleanup_pending_orders_probe.sql
```

The psql script is the better of the two for this property. It wraps the seeding, both
cleanup runs and the verdicts in one transaction that ends in `ROLLBACK`, so it also undoes
any **non-probe** row the cleanup runs deleted. It additionally prints
`pg_get_functiondef` for the installed function, the `cron.job` row, and whether
`orders.payment_initiated_at` exists — the three drift facts the model half cannot see.

## Counterexamples

### 1. An in-flight order is deleted mid-verification

```
Property failed after 45 tests
Counterexample: {"payment_status":"pending","status":"pending","payment_method":"online",
                 "created_at_age":6,"payment_initiated_at_age":6}
DELETED [payment_status = 'pending' => true | status = 'pending' => true
       | created_at < NOW() - INTERVAL '5 minutes' => true
       | payment_method != 'cod' => true | payment_method != 'cash' => true]
```

Every condition is satisfied by a legitimate order that is six minutes into an online
payment and has not yet been verified. Under Property 4 and clause 3.6 this row must
survive; the predicate deletes it.

**The window is narrower than it looks.** The threshold is 5 minutes, and the job runs every
5 minutes, so a row is not deleted the instant it crosses the threshold but on the next
scheduled pass. The reachable deletion age is therefore **5 to 10 minutes** — recorded by
the suite as an evidence assertion:

```
[task 5] reachable deletion age: 5-10 minutes (window 5m, schedule every 5m)
```

That span sits squarely inside a plausible callback-to-verification gap: a UPI collect
request, an app switch, a bank redirect, a device that loses connectivity right after the
callback, or a retry. The migration's own header comment argues the risk away — "orders are
only created after payment succeeds for online payments, so this cleanup should rarely be
needed" — and task 11.3 makes that comment false by design, since the order is created
*before* the sheet opens. Task 12.1 already plans to delete the comment; it is worth noting
that the comment is the entire safety argument for the 5-minute window.

### 2. Orders checkout creates are never cleaned up

```
Property failed after 1 tests
Counterexample: {"payment_status":"pending","status":"draft","payment_method":"online",
                 "created_at_age":16,"payment_initiated_at_age":16}
SPARED [payment_status = 'pending' => true | status = 'pending' => FALSE
      | created_at < NOW() - INTERVAL '5 minutes' => true
      | payment_method != 'cod' => true | payment_method != 'cash' => true]
```

The other direction. `status = 'pending'` is a required conjunct, so **any** status other
than `'pending'` puts a row permanently out of cleanup's reach, at any age. `fast-check`
shrank to `'draft'` — which is the column default from
`20250105000000_create_orders.sql:12` — but the reachable value that matters is `'placed'`,
which `app/(main)/checkout/index.tsx` writes at lines 135, 246 and 320. The concrete test
pins that value directly:

```
✕ an online pending order with status placed is reclaimed once it is abandoned
  atSixMinutes:    SPARED   (correct)
  atTwentyMinutes: SPARED   (wrong — expected DELETED)
```

So an abandoned online order accumulates forever. The defect is broader than the `'placed'`
case task 5 predicted: cleanup reaches only rows whose `status` is literally `'pending'`,
and that is neither the column default nor what checkout writes.

This is why task 12.1's decision to **stop keying on `status` at all** is the right call
rather than a cosmetic simplification. `status` is a fulfilment-lifecycle field; coupling
payment reclamation to it is what produced both this failure and, through the same
conjunct, the reachable-age narrowing in counterexample 1.

### 3. Cleanup racing the paid transition can lose a captured payment

```
Counterexample: {"payment_status":"pending","status":"pending","payment_method":"online",
                 "created_at_age":6,"payment_initiated_at_age":6}
  orderingA_paidThenCleanup: SPARED    (fine)
  orderingB_cleanupThenPaid: DELETED   (the failure)
  hypotheticalSplitWrite:    SPARED
```

Both orderings are checked, because only one of them is a question about the row's final
state:

- **A — the paid transition commits, then cleanup evaluates.** Safe iff a paid row does not
  match the predicate. It does not, so A passes today.
- **B — cleanup evaluates first, on the row as it stands mid-verification.** Safe iff an
  in-flight row cannot match at all. It can, so the row is deleted before the paid write
  lands, and the money has been captured at Razorpay with no order to attach it to. No
  subsequent ordering recovers that.

Ordering B is the whole reason the grace window has to **exceed the worst-case verification
latency** rather than merely be nonzero. It is not fixable by making the paid write faster
or more atomic, and the third line above says so: `hypotheticalSplitWrite` models the state
that would exist if `mark_order_paid` set `payment_status` and cleared the marker in two
separate statements instead of one, and it is spared either way, because the design's
predicate keys on `payment_status = 'pending'`. Atomicity is worth keeping — but it is not
what protects an in-flight order. The window is.

The suite asserts the split-write case explicitly so this property does not silently depend
on an atomicity guarantee that lives in a different task (11.1).

## Preserved baseline — these already hold and must keep holding

Both pass on the unfixed predicate. Task 12.2 must keep them passing; a fix that reclaims
abandoned orders by deleting paid or COD ones is not a fix.

| Property | Result |
| --- | --- |
| `spares every paid order, whatever its age, status or method` | **PASSES** (500 generated rows) |
| `spares every order whose payment is not taken online (COD and cash)` | **PASSES** (500 generated rows) |

## What the predicate actually matches today

Worth establishing before task 12.1, because it changes how the fix should be read: the
current predicate is close to a **no-op in production**, and that is not a defence — it is
the reason the defect has gone unnoticed, and it stops being true the moment task 11.3
lands.

Every path in the tree that inserts into `orders` was enumerated. To match, a row needs
`status = 'pending'` **and** `payment_status = 'pending'` **and** a `payment_method` that is
neither `'cod'` nor `'cash'`:

| Insert site | `status` | `payment_status` | `payment_method` | Matches? |
| --- | --- | --- | --- | --- |
| `app/(main)/checkout/index.tsx:127` (COD) | `'placed'` | `'pending'` | `'cash'` (mapped) | no — status and method |
| `app/(main)/checkout/index.tsx:312` (online) | `'placed'` | `'paid'` | `'online'` / `'upi'` | no — status and payment_status |
| `services/masterOrderService.ts:100` | `'placed'` | `'paid'` | `'online'` / `'upi'` | no |
| `app/(main)/orders/index.tsx:203` (reorder) | `'pending'` | `'pending'` | column default `'cash'` | no — method only |
| `services/aiOrderPlacement.ts:56` | `'pending'` | `'pending'` if COD, else `'not_paid'` | as passed | no — either method or payment_status |
| `services/aiAgent/bedrockAIService.ts:2719` | `'pending'` | via `aiOrderPlacement` | defaults `'cod'` (line 2530) | no |
| `services/whatsapp/WhatsAppAIService.ts:254` | `'pending'` | not set → `'pending'` | `'cod'` | no — method |
| `services/aiAgent/phoneCallAgent.ts:337` | `'pending'` | not set → `'pending'` | not set → default `'cash'` | no — method |
| `services/aiOrderService.ts:43` | caller-supplied | not set → `'pending'` | not set → default `'cash'` | no — method |
| `components/ai/VoiceLiveInterface.tsx:244` | `'pending'` | not set → `'pending'` | `payment_method \|\| 'cod'` | **yes, when the caller passes anything other than cod/cash** |

One reachable match, and it is on a voice-ordering path (that insert also names `total` and
`notes`, columns absent from the committed `orders` schema, so it may well be failing before
cleanup ever sees the row — not chased down here).

Two things follow:

1. **Clause 3.6's "SHALL CONTINUE TO remove stale unpaid orders" is preserving a behaviour
   that essentially does not occur.** Task 12.1 does not have to protect an existing
   reclamation flow; it has to build one. Worth saying out loud, because "preserve" framing
   invites caution that is not owed here.
2. **The exposure inverts at task 11.3.** After it, every online checkout writes exactly
   `payment_status = 'pending'` with an online method — the shape counterexample 1 deletes.
   The reason `status` currently reads `'placed'` rather than `'pending'` is the only thing
   standing between this predicate and deleting in-flight payments at scale, and it is an
   accident, not a control. **Ordering matters: task 12.1 must land with or before 11.3**,
   not after.

## Corrections to the predictions

Neither correction refutes the root cause. Both change what task 12.1 has to get right, so
both are recorded rather than quietly absorbed.

### `payment_method` is never `'razorpay'` on an order row

Task 5 and design.md §1e both describe the domain as payment methods `razorpay`, `cod`,
`cash`. Checkout stores none of the first two. `mapPaymentMethod`
(`app/(main)/checkout/index.tsx:64-78`) folds the value first:

```
'cod'                              -> 'cash'
'razorpay' | 'card' | 'netbanking' -> 'online'
'upi'                              -> 'upi'
anything else                      -> 'cash'      <- default branch
```

So a Razorpay order is stored as `'online'`, and a COD order as `'cash'`. `'razorpay'` and
`'cod'` do reach the column, but only from the AI and WhatsApp order paths. The model and
the psql probe both use the real values; the concrete test cases assert `'cash'` and
`'cod'` side by side so the COD baseline covers both spellings.

**Consequence for task 12.1:** keeping `payment_method NOT IN ('cod', 'cash')` is correct
and sufficient, but not for the reason the clause implies. COD is spared because the mapping
happens to produce `'cash'`, not because of the `'cod'` conjunct. The `'cod'` conjunct
protects the AI paths only.

**And that default branch is a latent hazard the other way.** An unrecognised method type
becomes `'cash'`, so a genuinely online payment stored as `'cash'` would never be reclaimed
under either the old predicate or the new one. Not a Property 4 failure — the safe
direction — but it means the reclaim set silently depends on `mapPaymentMethod` staying
exhaustive.

### `'credit'` is inside the delete set

`orders.payment_method` admits `'credit'`
(`20250120000001_update_orders_payment_method_constraint.sql:21`), and `'credit'` is neither
`'cod'` nor `'cash'`, so a credit-terms order sitting at `payment_status = 'pending'` — which
is what a pay-later order *is* — matches the current predicate and is deleted.

No code path writes `payment_method = 'credit'` today (the credit feature uses
`payment_terms` and its own tables), so this is latent rather than active, and it is left out
of the asserted baseline deliberately: a failing assertion for an unreachable case would
muddy the counterexample report. It is recorded because the task 12.1 predicate happens to
close it for the right reason — a credit order never opens the online sheet, so
`payment_initiated_at IS NOT NULL` is false — and because that protection would evaporate if
anyone ever set the marker on a non-online order.

## Open items for task 12.1 / 12.2

1. **Land 12.1 with or before 11.3.** After 11.3 every online order carries the shape
   counterexample 1 deletes, and only the incidental `status = 'placed'` value is preventing
   that today.
2. **Legacy rows are outside the new reclaim set.** `payment_initiated_at IS NOT NULL`
   excludes every row that exists today, so pre-migration abandoned online orders are never
   reclaimed. The `must-delete` property is scoped to marker-carrying rows for exactly this
   reason. Decide explicitly: a one-off backfill, a one-off delete, or accept the residue and
   say so. Do not leave it implicit.
3. **Do not set `payment_initiated_at` on COD, cash or credit orders.** The whole
   offline-method protection in the new predicate rests on that marker being NULL for them.
   Task 11.3 sets it only on the online path; worth an assertion rather than a convention.
4. **Run the empirical half** (Jest or the psql script) against a branch database before
   treating 12.1 as verified, and diff the installed `pg_get_functiondef` against the
   committed migration. The model half proves the committed predicate is right; only the
   empirical half proves the applied one is.
5. **Confirm the job is scheduled at all** — task 13.1. The existing migration warns and
   continues when `pg_cron` is absent, so a silently unscheduled job is possible, and a
   correct predicate that never runs reclaims nothing. The psql probe prints the `cron.job`
   row for this.
6. **Replace the partial index**, per 12.1. The current one is
   `ON orders(created_at, payment_status, status, payment_method) WHERE payment_status = 'pending' AND status = 'pending'`
   and will not serve the new predicate at all.

## The test is falsifiable

A bug-condition test that can never go green is worthless for verifying the fix, so this was
checked rather than assumed. The task 12.1 predicate was added as a temporary sketch
migration:

```sql
DELETE FROM orders
 WHERE payment_status = 'pending'
   AND payment_method NOT IN ('cod', 'cash')
   AND payment_initiated_at IS NOT NULL
   AND payment_initiated_at < NOW() - INTERVAL '15 minutes'
```

The suite reported **12 passed, 0 failed, 6 skipped** — all five failures flipped, with the
four baseline and evidence assertions still passing. The extractor picked the sketch up on
its own and printed the new predicate, confirming that task 12.2 needs no edit to this file:

```
[task 5] predicate under test, from supabase/migrations/29999999999999_SKETCH_...sql:
  WHERE payment_status = 'pending' AND payment_method NOT IN ('cod', 'cash')
    AND payment_initiated_at IS NOT NULL
    AND payment_initiated_at < NOW() - INTERVAL '15 minutes'
  age threshold: 15 minute(s) on payment_initiated_at
  pg_cron period: 5 minute(s)
[task 5] reachable deletion age: 15-20 minutes (window 15m, schedule every 5m)
```

The sketch was then deleted. `git status supabase/migrations` is clean and the five failures
are back.

The properties are deliberately **mechanism-agnostic about the column**: they assert what
must and must not be deleted, not which field the predicate reads. A fix that keyed the
grace window on `created_at` instead of `payment_initiated_at` would also pass, which is
correct — the property is about behaviour.

## Effect on the verification baseline

Compared with `docs/VERIFICATION_BASELINE.md` and the task 2, 3 and 4 deltas:

- `npm test`: **54 suites** (was 53), **686 tests** (was 668), **642 passing** (was 635 —
  the 7 new passes are this file's baseline, extraction evidence and skip record),
  **34 failing** (was 29: 5 pre-existing + 7 from task 2 + 3 from task 3 + 14 from task 4 +
  **5 deliberate here**), **10 skipped** (was 4 — this file's 6-test empirical half).
- `npm run typecheck`: **632 errors — unchanged.** `tests/**` is excluded from the typecheck
  scope; the new file was type-checked separately and is clean.

No regression. The 5 failures here are expected and must stay failing until task 12.1 lands.
