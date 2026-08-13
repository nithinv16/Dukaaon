/**
 * Bug-condition exploration probe — database authority over `payment_status`.
 *
 * Spec: .kiro/specs/critical-security-and-error-fixes (task 3)
 * Property 1: Bug Condition — Paid State Requires Server-Verified Signature
 *             (database-level half)
 *
 * **Validates: Requirements 1.20, 2.20**
 *
 * THIS SUITE IS EXPECTED TO FAIL ON THE UNFIXED SCHEMA. Task 2 proved the
 * *client* authors paid state. This probe asks the independent question: if the
 * client were fixed, would anything in the database still stop a user's own
 * credentials from writing `payment_status = 'paid'`? The expected answer today
 * is no, and each failure below is that finding.
 *
 * Do not weaken the assertions to make it green. It turns green when task 11.1
 * lands the `enforce_payment_status_authority` trigger and the
 * `mark_order_paid` security-definer RPC, which is how the fix is verified
 * (task 11.5).
 *
 * The probe has two halves:
 *
 *   1. EMPIRICAL — real writes under a real user JWT, through the same
 *      PostgREST path the app uses. Requires a local (`supabase start`) or
 *      explicitly provisioned branch database. SKIPPED with a printed reason
 *      when no such database is configured. It never runs against production:
 *      a non-local URL needs `PROBE_ALLOW_REMOTE=yes`, and the known production
 *      project ref is hard-blocked.
 *
 *   2. STATIC — always runs. Scans the committed migrations and SQL scripts for
 *      any database-level authority over `payment_status`: a gating trigger, a
 *      security-definer writer, or an RLS write policy that constrains the
 *      column. This half needs no database and is what confirms the finding
 *      when the empirical half cannot run.
 *
 * Env contract for the empirical half:
 *   PROBE_SUPABASE_URL               e.g. http://127.0.0.1:54321
 *   PROBE_SUPABASE_ANON_KEY          the anon key — this is the attacker's key
 *   PROBE_SUPABASE_SERVICE_ROLE_KEY  used ONLY to seed and clean up
 *   PROBE_ALLOW_REMOTE=yes           required when the URL is not localhost
 *
 * The equivalent probe as a psql script, for operators who have direct database
 * access rather than a REST endpoint, is
 * `supabase/probes/payment_status_authority_probe.sql`.
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** SQLSTATE the fixed schema must raise. Design: `ERRCODE = 'insufficient_privilege'`. */
const INSUFFICIENT_PRIVILEGE = '42501';

/**
 * Production project ref, from `constants/config.ts:5`. Hard-blocked so this
 * file can never be pointed at live money by an inherited environment.
 */
const PRODUCTION_PROJECT_REF = 'xcpznnkpjgyrpbvpnvit';

// ---------------------------------------------------------------------------
// Target resolution for the empirical half
// ---------------------------------------------------------------------------

type ProbeTarget = { url: string; anonKey: string; serviceRoleKey: string };

function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:\d+)?/i.test(url);
}

/**
 * Returns the probe target, or a human-readable reason why the empirical half
 * cannot run. Never throws — an absent database is an expected state here, not
 * an error, and it must not be mistaken for the bug being absent.
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
        'This probe writes orders and must never run there. Refusing.',
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
        'PROBE_SUPABASE_ANON_KEY and/or PROBE_SUPABASE_SERVICE_ROLE_KEY are not set. The anon key ' +
        'is the credential under test; the service-role key is used only to seed and clean up.',
    };
  }
  return { target: { url, anonKey, serviceRoleKey } };
}

const resolution = resolveProbeTarget();
const empiricalTarget = 'target' in resolution ? resolution.target : null;
const empiricalSkipReason = 'skipReason' in resolution ? resolution.skipReason : null;

// ---------------------------------------------------------------------------
// Static analysis of the committed schema
// ---------------------------------------------------------------------------

type SqlFile = { file: string; sql: string };

function loadCommittedSql(): SqlFile[] {
  const dirs = [path.join(REPO_ROOT, 'supabase', 'migrations'), path.join(REPO_ROOT, 'sql')];
  const out: SqlFile[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.sql')) continue;
      const full = path.join(dir, name);
      out.push({
        file: path.relative(REPO_ROOT, full),
        sql: fs.readFileSync(full, 'utf8'),
      });
    }
  }
  return out;
}

const committedSql = loadCommittedSql();

/**
 * Function bodies, keyed by lower-cased function name, across every SQL file.
 * The body is cut at the dollar-quote terminator when there is one, and at the
 * next top-level CREATE otherwise, so one function's body never bleeds into the
 * next statement. That matters: a leaky body makes an unrelated function look
 * like it gates `payment_status`, which would understate the finding.
 */
function collectFunctionBodies(files: SqlFile[]): Map<string, { file: string; body: string }> {
  const bodies = new Map<string, { file: string; body: string }>();
  const decl = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([A-Za-z0-9_]+)\s*\(/gi;
  for (const { file, sql } of files) {
    let m: RegExpExecArray | null;
    while ((m = decl.exec(sql)) !== null) {
      const rest = sql.slice(m.index);
      const tag = /\$([A-Za-z0-9_]*)\$/.exec(rest);
      let body: string;
      if (tag) {
        const close = rest.indexOf(tag[0], tag.index + tag[0].length);
        body = close === -1 ? rest : rest.slice(0, close + tag[0].length);
      } else {
        const nextCreate = rest.slice(1).search(/\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|TRIGGER|TABLE|POLICY|VIEW)\b/i);
        body = nextCreate === -1 ? rest : rest.slice(0, nextCreate + 1);
      }
      bodies.set(m[1].toLowerCase(), { file, body });
    }
  }
  return bodies;
}

const functionBodies = collectFunctionBodies(committedSql);

type TriggerInfo = {
  file: string;
  name: string;
  timing: string;
  events: string;
  table: string;
  functionName: string;
  gatesPaymentStatus: boolean;
};

function findTriggers(table: string): TriggerInfo[] {
  const found: TriggerInfo[] = [];
  // The event list is enumerated rather than matched with `[\s\S]*?` so the
  // pattern cannot run past the end of one CREATE TRIGGER into the next.
  const event = '(?:INSERT|UPDATE|DELETE|TRUNCATE)';
  const re = new RegExp(
    'CREATE\\s+TRIGGER\\s+([A-Za-z0-9_]+)\\s+' +
      '(BEFORE|AFTER|INSTEAD\\s+OF)\\s+' +
      `(${event}(?:\\s+OF\\s+[A-Za-z0-9_,\\s]+?)?(?:\\s+OR\\s+${event})*)` +
      '\\s+ON\\s+(?:public\\.)?' +
      table +
      '\\b([^;]*);',
    'gi'
  );
  for (const { file, sql } of committedSql) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      const fnMatch = /EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:public\.)?([A-Za-z0-9_]+)/i.exec(m[4]);
      const functionName = fnMatch ? fnMatch[1] : '<unknown>';
      const body = functionBodies.get(functionName.toLowerCase());
      // A gate inspects `payment_status` *and* rejects. A trigger that only
      // reads the column (stats, tracking) is not authority over it.
      const gatesPaymentStatus =
        !!body &&
        /payment_status/i.test(body.body) &&
        /(RAISE\s+EXCEPTION|ERRCODE|insufficient_privilege)/i.test(body.body);
      found.push({
        file,
        name: m[1],
        timing: m[2].replace(/\s+/g, ' ').toUpperCase(),
        events: m[3].replace(/\s+/g, ' ').toUpperCase(),
        table,
        functionName,
        gatesPaymentStatus,
      });
    }
  }
  return found;
}

type PolicyInfo = {
  file: string;
  name: string;
  table: string;
  command: string;
  statement: string;
  mentionsPaymentStatus: boolean;
  hasWithCheck: boolean;
};

function findPolicies(table: string): PolicyInfo[] {
  const found: PolicyInfo[] = [];
  const re = new RegExp(
    'CREATE\\s+POLICY\\s+"?([^"\\n]+?)"?\\s+ON\\s+(?:public\\.)?' + table + '\\b([\\s\\S]*?);',
    'gi'
  );
  for (const { file, sql } of committedSql) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      const tail = m[2];
      const cmd = /FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)/i.exec(tail);
      found.push({
        file,
        name: m[1].trim(),
        table,
        command: cmd ? cmd[1].toUpperCase() : 'ALL',
        statement: `CREATE POLICY "${m[1].trim()}" ON ${table}${tail};`.replace(/\s+/g, ' '),
        mentionsPaymentStatus: /payment_status/i.test(tail),
        hasWithCheck: /WITH\s+CHECK/i.test(tail),
      });
    }
  }
  return found;
}

/** Write policies are the ones that could gate a value; SELECT cannot. */
const isWritePolicy = (p: PolicyInfo) => ['INSERT', 'UPDATE', 'ALL'].includes(p.command);

/**
 * A function that owns the paid transition must actually assign the literal
 * `'paid'` to `payment_status` and run as SECURITY DEFINER. Matching anything
 * looser (a function that merely mentions both tokens) produces a false pass,
 * which on a bug-condition probe means silently understating the finding.
 */
function findSecurityDefinerPaidWriters(): { file: string; name: string }[] {
  const out: { file: string; name: string }[] = [];
  for (const [name, { file, body }] of functionBodies) {
    const assignsPaid = /payment_status\s*=\s*'paid'/i.test(body);
    if (assignsPaid && /SECURITY\s+DEFINER/i.test(body)) out.push({ file, name });
  }
  return out;
}

function findPaymentStatusCheckConstraints(table: string): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const re = /payment_status[^\n,]*CHECK\s*\(([\s\S]*?)\)\s*\)/gi;
  for (const { file, sql } of committedSql) {
    // Only look at the CREATE TABLE for the table in question.
    const tableRe = new RegExp(
      'CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?' + table + '\\s*\\(([\\s\\S]*?)\\n\\);',
      'i'
    );
    const t = tableRe.exec(sql);
    if (!t) continue;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(t[1])) !== null) {
      out.push({ file, text: m[0].replace(/\s+/g, ' ') });
    }
  }
  return out;
}

function findColumnPrivilegeStatements(): string[] {
  const out: string[] = [];
  const re = /^\s*(GRANT|REVOKE)\b[\s\S]*?;/gim;
  for (const { file, sql } of committedSql) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      if (/payment_status/i.test(m[0])) out.push(`${file}: ${m[0].replace(/\s+/g, ' ')}`);
    }
  }
  return out;
}

/**
 * Every mechanism by which the database could hold authority over
 * `payment_status` on `table`. Deliberately mechanism-agnostic: the design
 * chooses a trigger, but an RLS `WITH CHECK` on the column or a column-level
 * REVOKE would also count, and the probe should not fail a correct fix that
 * picked a different one.
 */
function findDatabaseAuthorityOver(table: string): {
  gatingTriggers: string[];
  columnConstrainingWritePolicies: string[];
  columnPrivilegeStatements: string[];
  securityDefinerPaidWriters: string[];
  anyAuthority: boolean;
  allTriggers: string[];
  allWritePolicies: string[];
} {
  const triggers = findTriggers(table);
  const gatingTriggers = triggers
    .filter((t) => t.gatesPaymentStatus && t.timing === 'BEFORE' && /INSERT|UPDATE/.test(t.events))
    .map((t) => `${t.name} (${t.timing} ${t.events} -> ${t.functionName}, ${t.file})`);

  const writePolicies = findPolicies(table).filter(isWritePolicy);
  const columnConstrainingWritePolicies = writePolicies
    .filter((p) => p.mentionsPaymentStatus)
    .map((p) => `${p.command} "${p.name}" (${p.file})`);

  const columnPrivilegeStatements = findColumnPrivilegeStatements().filter((s) =>
    new RegExp(`\\b${table}\\b`, 'i').test(s)
  );

  const securityDefinerPaidWriters = findSecurityDefinerPaidWriters().map(
    (f) => `${f.name} (${f.file})`
  );

  return {
    gatingTriggers,
    columnConstrainingWritePolicies,
    columnPrivilegeStatements,
    securityDefinerPaidWriters,
    anyAuthority:
      gatingTriggers.length > 0 ||
      columnConstrainingWritePolicies.length > 0 ||
      columnPrivilegeStatements.length > 0,
    allTriggers: triggers.map((t) => `${t.timing} ${t.events} -> ${t.functionName} (${t.file})`),
    allWritePolicies: writePolicies.map(
      (p) => `${p.command} "${p.name}" (${p.file}) withCheck=${p.hasWithCheck}`
    ),
  };
}

// ---------------------------------------------------------------------------
// STATIC HALF — always runs, no database required
// ---------------------------------------------------------------------------

describe('payment_status database authority — static probe (no database required)', () => {
  it('found the committed schema to analyse', () => {
    // Sanity check on the analyser itself, so a zero-finding result below can be
    // trusted as "nothing is there" rather than "nothing was read".
    expect(committedSql.length).toBeGreaterThan(50);
    expect(findPolicies('orders').length).toBeGreaterThan(0);
    expect(findPolicies('master_orders').length).toBeGreaterThan(0);
  });

  it('positive control: the only committed control over payment_status is a CHECK on values', () => {
    const orders = findPaymentStatusCheckConstraints('orders');
    const master = findPaymentStatusCheckConstraints('master_orders');

    expect(orders.length).toBeGreaterThan(0);
    expect(master.length).toBeGreaterThan(0);

    // The constraint admits 'paid' from anyone who can write the row at all.
    // It governs the value, not the actor. That distinction is the whole bug.
    expect(orders.some((c) => /'paid'/i.test(c.text))).toBe(true);
    expect(master.some((c) => /'paid'/i.test(c.text))).toBe(true);

    // No column-level GRANT/REVOKE narrows who may write the column either.
    expect(findColumnPrivilegeStatements()).toEqual([]);
  });

  it('evidence: the write policies on orders and master_orders are row-scoped only', () => {
    // This one PASSES before and after the fix, by design. Task 11.1 adds no
    // policy — it uses a trigger, because RLS `WITH CHECK` cannot express
    // "every column except this one". The finding recorded here is *why* a
    // trigger is the mechanism: the existing write policies decide which ROW a
    // caller may touch and say nothing about which VALUES they may set.
    for (const table of ['orders', 'master_orders']) {
      const writePolicies = findPolicies(table).filter(isWritePolicy);
      expect(writePolicies.length).toBeGreaterThan(0);
      // Every one of them is row-scoped on ownership and silent on the column.
      expect(writePolicies.filter((p) => p.mentionsPaymentStatus)).toEqual([]);
      // The UPDATE policies have no WITH CHECK at all, so Postgres reuses their
      // USING expression for the new row: ownership is re-checked, the column
      // is not.
      const updates = writePolicies.filter((p) => p.command === 'UPDATE');
      expect(updates.length).toBeGreaterThan(0);
      expect(updates.every((p) => !p.hasWithCheck)).toBe(true);
    }
  });

  it('orders: the database holds authority over who may write payment_status', () => {
    const authority = findDatabaseAuthorityOver('orders');
    expect(authority).toEqual(expect.objectContaining({ anyAuthority: true }));
  });

  it('master_orders: the database holds authority over who may write payment_status', () => {
    const authority = findDatabaseAuthorityOver('master_orders');
    expect(authority).toEqual(expect.objectContaining({ anyAuthority: true }));
  });

  it('a security-definer function owns the paid transition', () => {
    // After task 11.1 this is `mark_order_paid`, revoked from anon and
    // authenticated and granted to service_role only.
    expect(findSecurityDefinerPaidWriters()).not.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EMPIRICAL HALF — real writes under a real user JWT
// ---------------------------------------------------------------------------

describe('payment_status database authority — empirical probe', () => {
  it('records why the empirical half did or did not run', () => {
    if (empiricalTarget) {
      expect(empiricalTarget.url).toBeTruthy();
      return;
    }
    // Not a failure. An unavailable database is an unmet precondition, and it
    // must never be read as evidence that the bug is absent — the static half
    // above is what carries the finding in that case.
    console.warn(
      `[task 3] Empirical DB probe SKIPPED — NOT a pass and NOT a refutation.\n` +
        `Reason: ${empiricalSkipReason}\n` +
        `The static half of this suite still confirms the finding. To run the empirical ` +
        `half, see the header of this file or supabase/probes/payment_status_authority_probe.sql.`
    );
    expect(empiricalSkipReason).toBeTruthy();
  });

  const maybe = empiricalTarget ? describe : describe.skip;

  maybe('with a normal user JWT (anon key + signed-in user)', () => {
    const target = empiricalTarget as ProbeTarget;
    const probeEmail = `payment-authority-probe+${Date.now()}@example.invalid`;
    const probePassword = `Probe!${Math.random().toString(36).slice(2)}Aa1`;

    let service: any;
    let asUser: any;
    let userId = '';
    let orderId = '';
    let masterOrderId = '';

    beforeAll(async () => {
      const { createClient } = require('@supabase/supabase-js');
      service = createClient(target.url, target.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const created = await service.auth.admin.createUser({
        email: probeEmail,
        password: probePassword,
        email_confirm: true,
      });
      if (created.error) throw created.error;
      userId = created.data.user.id;

      // Seed as service_role, which bypasses RLS. Seeding is not under test.
      const profile = await service
        .from('profiles')
        .insert({ id: userId, phone_number: `+9199${Date.now().toString().slice(-8)}`, role: 'retailer' });
      if (profile.error) throw profile.error;

      const order = await service
        .from('orders')
        .insert({
          order_number: `PROBE-${Date.now()}`,
          seller_id: userId,
          user_id: userId,
          total_amount: 100,
          payment_method: 'razorpay',
          payment_status: 'pending',
        })
        .select('id')
        .single();
      if (order.error) throw order.error;
      orderId = order.data.id;

      const master = await service
        .from('master_orders')
        .insert({
          order_number: `PROBE-M-${Date.now()}`,
          user_id: userId,
          total_amount: 100,
          grand_total: 100,
          delivery_address: { line1: 'probe' },
          payment_method: 'razorpay',
          payment_status: 'pending',
        })
        .select('id')
        .single();
      if (master.error) throw master.error;
      masterOrderId = master.data.id;

      // The credential under test: the public anon key plus this user's JWT.
      // Exactly what an attacker recovers from the shipped APK.
      asUser = createClient(target.url, target.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signIn = await asUser.auth.signInWithPassword({
        email: probeEmail,
        password: probePassword,
      });
      if (signIn.error) throw signIn.error;
    }, 60000);

    afterAll(async () => {
      if (!service) return;
      if (orderId) await service.from('orders').delete().eq('id', orderId);
      if (masterOrderId) await service.from('master_orders').delete().eq('id', masterOrderId);
      await service.from('orders').delete().eq('user_id', userId);
      if (userId) {
        await service.from('profiles').delete().eq('id', userId);
        await service.auth.admin.deleteUser(userId);
      }
    }, 60000);

    it('rejects UPDATE orders SET payment_status = paid', async () => {
      const { data, error } = await asUser
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('user_id', userId)
        .select('id, payment_status');

      expect({ code: error?.code, rowsUpdated: data?.length ?? 0 }).toEqual({
        code: INSUFFICIENT_PRIVILEGE,
        rowsUpdated: 0,
      });

      const after = await service.from('orders').select('payment_status').eq('id', orderId).single();
      expect(after.data?.payment_status).toBe('pending');
    }, 30000);

    it('rejects UPDATE master_orders SET payment_status = paid', async () => {
      const { data, error } = await asUser
        .from('master_orders')
        .update({ payment_status: 'paid' })
        .eq('user_id', userId)
        .select('id, payment_status');

      expect({ code: error?.code, rowsUpdated: data?.length ?? 0 }).toEqual({
        code: INSUFFICIENT_PRIVILEGE,
        rowsUpdated: 0,
      });

      const after = await service
        .from('master_orders')
        .select('payment_status')
        .eq('id', masterOrderId)
        .single();
      expect(after.data?.payment_status).toBe('pending');
    }, 30000);

    it('rejects INSERT INTO orders with payment_status = paid', async () => {
      // This is the shape app/(main)/checkout/index.tsx:321 writes today.
      const { data, error } = await asUser
        .from('orders')
        .insert({
          order_number: `PROBE-INS-${Date.now()}`,
          seller_id: userId,
          user_id: userId,
          total_amount: 100,
          payment_method: 'razorpay',
          payment_status: 'paid',
        })
        .select('id, payment_status');

      expect({ code: error?.code, rowsInserted: data?.length ?? 0 }).toEqual({
        code: INSUFFICIENT_PRIVILEGE,
        rowsInserted: 0,
      });
    }, 30000);

    it('still allows INSERT INTO orders at payment_status = pending (COD path, clause 3.1)', async () => {
      // Preservation control inside the probe: the fix must reject 'paid', not
      // reject the column. A trigger that broke this would break COD checkout.
      const { data, error } = await asUser
        .from('orders')
        .insert({
          order_number: `PROBE-COD-${Date.now()}`,
          seller_id: userId,
          user_id: userId,
          total_amount: 100,
          payment_method: 'cod',
          payment_status: 'pending',
        })
        .select('id, payment_status');

      expect(error).toBeNull();
      expect(data?.[0]?.payment_status).toBe('pending');
    }, 30000);
  });
});
