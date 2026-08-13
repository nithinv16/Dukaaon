# Phase 1 — the Razorpay key secret in build artifacts (bug-condition counterexamples)

Recorded by task 4 of `.kiro/specs/critical-security-and-error-fixes`.

Property under test: **Property 3 — No Razorpay Secret in Any Build Artifact** (design.md).
Bugfix clauses **1.1, 1.2, 1.3 / 2.1, 2.2, 2.3**.

Test: `tests/security/razorpaySecretInBuildArtifacts.bugCondition.test.ts`
Command: `npx jest tests/security/razorpaySecretInBuildArtifacts.bugCondition.test.ts`

Result on the unfixed tree: **20 tests — 14 failed, 6 passed.** Every failure is a
predicted counterexample. The root-cause analysis in design.md is **confirmed**, with
two corrections to the predicted locations recorded under
[Corrections to the predictions](#corrections-to-the-predictions).

The same file turns green under task 9.2 and is what verifies the fix. It was checked to
be capable of that — see [The test is falsifiable](#the-test-is-falsifiable).

## Verdict at a glance

| Question | Answer |
| --- | --- |
| Is the live key secret in an artifact the Android build packages? | **Yes, in two of them**, by two independent routes. |
| Does setting `EXPO_PUBLIC_RAZORPAY_KEY_SECRET` fix it? | **No.** All four env combinations ship *a* key secret to the client. Setting the variable only changes which secret leaks. |
| Does the build fail when `EXPO_PUBLIC_RAZORPAY_KEY_ID` is unset? | **No.** It exits 0 and substitutes the live production key id. |
| Do the committed docs carry placeholders? | **No.** Five doc files carry live values; a sixth publishes a truncated secret. |
| Does any source module export a key secret to the client? | **Yes**, four export paths across two modules. |

## Which artifacts were inspected, and what that proves

A signed APK was not built. A Jest suite cannot run the native toolchain, and the spec
does not require it to. Two cheaper artifacts stand in, and between them they cover both
routes by which a credential reaches a device. Being precise about this matters, because
"we grepped a bundle" is a weaker claim than clause 1.1 makes.

### Artifact 1 — `assets/app.config`, and why it is not an approximation

This is the serialized **public** app config. It is not a dev-time stand-in for an APK
artifact, it *is* one. `expo-constants/scripts/get-app-config-android.gradle` registers a
`createExpoConfig` Gradle task that:

- runs `expo-constants/scripts/getAppConfig.js`,
- adds its output directory to `android.sourceSets.main.assets.srcDirs`, so the result is
  packaged into the APK,
- is marked `outputs.upToDateWhen { false }`, so it regenerates on **every** build.

The test invokes the same script the Gradle task invokes, so the bytes it inspects are the
bytes that ship, and `Constants.expoConfig.extra` reads them at runtime. This is the route
`app.config.js` uses. A sanity probe asserts all three of those gradle facts, so the claim
does not rest on this document being read.

### Artifact 2 — the Metro/Hermes JS bundle

What ships as `assets/index.android.bundle`. This is the route the `config/*.ts` modules
use, since their fallbacks are ordinary string literals in the module graph. Both forms
were exported and inspected:

```bash
# Hermes bytecode — byte-for-byte what a release APK carries
npx expo export --platform android --output-dir .probe-export
# plain JS — same graph, each source site visible separately
npx expo export --platform android --no-bytecode --output-dir .probe-export-js
```

Both export directories are gitignored. The test greps whichever it finds (override with
`PROBE_BUNDLE_DIR`) and **skips loudly** with the commands above when it finds none, rather
than passing quietly. An absent bundle is an unmet precondition, not evidence of a clean
bundle.

### What this does not prove

Nothing here inspects a signed APK, an AAB, or the native `.so` and resource surface. It
proves the credential is present in the two artifacts the Android build packages, which is
what clause 1.1 asserts and is the strongest claim available without a native toolchain
run. **A grep of a real APK remains worth doing once at task 9.2** as the belt-and-braces
check.

## Why exhaustive enumeration rather than `fast-check`

Property 3 quantifies over combinations of set/unset `EXPO_PUBLIC_RAZORPAY_*`. There are
two variables, so the domain has exactly four points. Enumerating all four is strictly
stronger than sampling them, and it makes the test a proof of the universally quantified
statement rather than evidence for it. `fast-check` would add generation machinery and
lose the guarantee. It is used elsewhere in this spec (Properties 1, 2, 4, 6) where the
domains are genuinely large.

## Counterexamples

### 1. All four env combinations ship a key secret in the APK asset

The complete domain, generated through the real Gradle script:

| `KEY_ID` | `KEY_SECRET` | exit | build fails loudly? | key-secret field in `extra`? | leaked live secret embedded? | leaked live key id embedded? |
| --- | --- | --- | --- | --- | --- | --- |
| unset | unset | 0 | no | **yes** | **yes** | **yes** |
| set | unset | 0 | no | **yes** | **yes** | no |
| unset | set | 0 | no | **yes** | no | **yes** |
| set | set | 0 | no | **yes** | no | no |

Three findings, in descending order of how badly they were predicted:

1. **`extra.EXPO_PUBLIC_RAZORPAY_KEY_SECRET` is present in 4 of 4 combinations.** This is
   sharper than clause 1.1, which frames the problem as a *fallback*. The fallback
   determines *which* secret ships; the `extra` entry itself determines *that* one ships.
   A correctly configured production build with both variables set still hands the device a
   Razorpay key secret. Setting the environment variable is not a mitigation, and any
   remediation that only removes the `|| "..."` fallback would leave the clause unmet.
   Source: `app.config.js:282` — the entry, not just its default.
2. **2 of 4 combinations embed the specific leaked live secret** (those with `KEY_SECRET`
   unset), and **2 of 4 embed the leaked live key id** (those with `KEY_ID` unset).
3. **0 of 4 combinations fail the build.** Clause 1.3 confirmed: with `KEY_ID` unset the
   generator exits 0 and the live production key id is silently substituted. Nothing warns.

The four combinations are generated with both variables explicitly deleted from the child
environment before the combination is applied, so an ambient value cannot skew the result.
That defence is not theoretical — see [Harness traps](#harness-traps).

### 2. The shipped JS bundle contains both live values

| Bundle | leaked secret | leaked key id |
| --- | --- | --- |
| `.probe-export/.../entry-*.hbc` (Hermes bytecode) | 1 occurrence | 1 occurrence |
| `.probe-export-js/.../entry-*.js` (plain JS) | 3 occurrences | 3 occurrences |

The plain-JS bundle shows all three module-graph sites, in the minified output:

```
razorpayConfig={keyId:p('EXPO_PUBLIC_RAZORPAY_KEY_ID','<LIVE_KEY_ID>'),
                keySecret:p('EXPO_PUBLIC_RAZORPAY_KEY_SECRET','<LIVE_KEY_SECRET>')}
```
→ `config/secrets.ts:49-50`

```
_=t('EXPO_PUBLIC_RAZORPAY_KEY_ID','<LIVE_KEY_ID>'),p=t('EXPO_PUBLIC_RAZORPAY_KEY_SECRET','<LIVE_KEY_SECRET>')
```
→ `config/razorpay.ts:25-26`

```
\nEXPO_PUBLIC_RAZORPAY_KEY_ID=<LIVE_KEY_ID>\nEXPO_PUBLIC_RAZORPAY_KEY_SECRET=<LIVE_KEY_SECRET>\n
```
→ `config/razorpay.ts:71-72`, the `ENV_TEMPLATE` string

**The Hermes count of 1 is not a smaller leak, and the difference is worth understanding
before anyone reads a count as a severity.** Hermes packs its string table so that a string
which is a substring of another shares its storage, recording only an offset and a length.
The bare literal at `config/razorpay.ts:26` therefore points into the middle of the
`ENV_TEMPLATE` buffer instead of getting its own bytes. Verified: the single ASCII
occurrence in the `.hbc` sits at offset 894862, inside
`...EXPO_PUBLIC_RAZORPAY_KEY_SECRET=<LIVE_KEY_SECRET>\n\n\n# Note: Key s...`. One byte-level
occurrence, three source sites, and a `strings`-and-grep recovery that takes seconds
either way.

### 3. Four fallback sites in source — all four predictions confirmed

Clause 1.1 named four. All four are present at the predicted `file:line`:

| Site | Line | What |
| --- | --- | --- |
| `app.config.js` | **282** | `extra.EXPO_PUBLIC_RAZORPAY_KEY_SECRET` fallback |
| `config/razorpay.ts` | **26** | `keySecret` constant fallback |
| `config/razorpay.ts` | **72** | `ENV_TEMPLATE` string |
| `config/secrets.ts` | **50** | `razorpayConfig.keySecret` fallback |

The scan also reports the live **key id** at the adjacent line of each — `app.config.js:281`,
`config/razorpay.ts:25`, `config/razorpay.ts:71`, `config/secrets.ts:49` — for 8 source
sites in total across 3 files.

### 4. Four export paths hand a key secret to client code

Checked on the real modules rather than by reading source, so a re-export or an object
spread cannot hide:

```
config/razorpay -> razorpayConfig.keySecret
config/razorpay -> default.keySecret
config/secrets  -> razorpayConfig.keySecret
config/secrets  -> default.razorpay.keySecret
```

Clause 2.1 requires the client to hold `keyId` only. Worth noting alongside the design's
observation that **nothing in the app reads `razorpayConfig.keySecret`** — the field is
vestigial, so removing it costs nothing.

### 5. Live values in five committed doc files, not two

Clause 1.2 named two files. The scan finds **11 doc sites across 5 files**:

| File | Lines | What |
| --- | --- | --- |
| `docs/RAZORPAY_FIX_CACHE.md` | **65** | **live key secret** |
| `docs/RAZORPAY_FIX_CACHE.md` | 51, 56, 64, 73, 74, 112 | live key id |
| `docs/RAZORPAY_TROUBLESHOOTING.md` | 12 | live key id |
| `docs/RAZORPAY_UPI_DEBUGGING.md` | 52, 136 | live key id |
| `docs/RAZORPAY_UPI_APPS_NOT_SHOWING.md` | 112 | live key id |
| `docs/guides/RAZORPAY_INTEGRATION.md` | 21 | **truncated key secret** — see below |

`docs/RAZORPAY_FIX_CACHE.md:65` is confirmed exactly as predicted. The three
`RAZORPAY_UPI_*` / `RAZORPAY_TROUBLESHOOTING` files are new to the inventory and were
missed by the original diagnostic pass. **Task 9.1's file list is incomplete and needs
extending to all five.**

## Corrections to the predictions

Neither correction refutes the root cause. Both change what task 9.1 has to edit, so both
are recorded rather than quietly absorbed.

### `docs/guides/RAZORPAY_INTEGRATION.md:~185` is already a placeholder

Clause 1.2 predicts the live key secret and live key id "in plain text" at approximately
line 185 of that file. Lines 184-185 in fact read:

```env
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx
EXPO_PUBLIC_RAZORPAY_KEY_SECRET=xxx
```

That is correct as written and needs no change. The real disclosure in that file is 164
lines earlier, at **line 21**, and it is **truncated**:

```markdown
- **Key ID**: `rzp_live_R`
- **Key Secret**: `XNC1LWew` (used for backend verification only)   ← first 8 of 24 chars
```

An exact-match grep — the check clause 2.1 specifies, and the one a reviewer would reach
for — reports this file as clean. The secret is 24 characters of base64-ish alphabet;
publishing the first 8 removes a third of the entropy from anyone brute-forcing the rest,
so a truncated "example" is still a disclosure. The suite asserts this separately
(`no committed file publishes a truncated Razorpay key secret`, minimum prefix length 6)
so the task 9.1 edit cannot leave a partial credential behind and still go green.

**Action for task 9.1:** edit `docs/guides/RAZORPAY_INTEGRATION.md:20-21`, not ~185.

### The doc inventory is 5 files, not 2

Recorded above under counterexample 5.

## The test is falsifiable

A bug-condition test that can never go green is worthless for verifying the fix, so this
was checked rather than assumed. The task 9.1 fix was applied as a temporary sketch —
`app.config.js` guard plus no fallbacks, `keySecret` removed from both config modules,
`ENV_TEMPLATE` placeholders, all five docs placeholdered including the truncated prefix —
a fresh bundle was exported, and the suite reported **20 passed, 0 failed**. The sketch was
then reverted with `git checkout --`; the tree is unchanged and the 14 failures are back.

Two things the falsifiability run incidentally proved:

- **The needle-recovery fallback works.** With the fallbacks removed from the working tree,
  the suite recovered the credential from `git 441065b:config/razorpay.ts` and kept
  grepping. It logged the source it used. This is what lets the same file verify the fix
  instead of going quiet once the plaintext is gone from the tree.
- **`buildFailedLoudly` responds to a real guard**, not just to a missing file: the
  `throw` added at the top of `app.config.js` produced a nonzero exit from the Gradle
  config task in both `KEY_ID`-unset combinations.

## The leaked value is not written into this file or the test

Adding another copy of a live credential to the repo in order to test for its absence would
be self-defeating. Neither this document nor the test file contains the plaintext. Instead:

- The test recovers the needle at runtime from a copy that already exists — the working
  tree while task 9.1 has not landed, then `git 441065b:config/razorpay.ts`, where the spec
  records it as permanently present.
- Recovery is pinned by **SHA-256** of each value, so a wrong or truncated needle cannot
  silently weaken every grep in the suite. A hash discloses nothing.
- Every excerpt printed by the suite and quoted above is redacted to
  `<LIVE_KEY_SECRET>` / `<LIVE_KEY_ID>`, including the truncated-prefix report, which
  reports a length rather than the characters.
- The one exception is the `XNC1LWew` prefix quoted once above, because the correction it
  documents is unintelligible without showing what an exact-match grep misses. It is 8 of
  24 characters and it is already committed at `docs/guides/RAZORPAY_INTEGRATION.md:21`,
  which is the point being made. Task 9.1 removes it from there; this record should be
  redacted at the same time.

## Harness traps

Recorded so they are not rediscovered.

**An ambient `EXPO_PUBLIC_RAZORPAY_*` in the shell silently changes what the suite
measures.** Found the hard way: an `export` left over from manual enumeration was inherited
by `expo export`, and the resulting bundle reflected the exported values instead of the
fallbacks — which would have looked like a partial pass. The four in-process combinations
are immune, because the generator deletes both variables from the child environment before
applying the combination. A bundle exported out of band is not immune. The suite now prints
a warning when either variable is set in the ambient environment, and the export commands
in this document are the safe form:

```bash
env -u EXPO_PUBLIC_RAZORPAY_KEY_ID -u EXPO_PUBLIC_RAZORPAY_KEY_SECRET \
  npx expo export --platform android --output-dir .probe-export
```

**Hermes bytecode must be read as `latin1`, not `utf8`.** Reading it as UTF-8 inserts
replacement characters that can split a needle across a boundary and lose a match.

**`getAppConfig.js` requires its output directory to exist**, and exits nonzero without a
clear message when it does not. The test creates one with `mkdtempSync` per combination.
Worth knowing, because "nonzero exit" is also the signal `buildFailedLoudly` reads, and a
missing directory would look like a passing assertion.

## Relationship to task 7 (key rotation)

This task and task 9.1 close the leak **in the tree**. They do not close it **in reality**.
The secret is in git history from commit `441065b` and in every build produced since, so
every APK already distributed still carries it. Task 7 — a human rotating the key in the
Razorpay dashboard and disabling the old pair — is the only real remediation, and clause
2.3 stays unmet until that is confirmed.

Concretely: this suite going green at task 9.2 proves the tree is clean. It says nothing
about whether the credential is still valid. Do not read a green Property 3 as "the leak is
handled".

## Effect on the verification baseline

Compared with `docs/VERIFICATION_BASELINE.md` and the task 2 and 3 deltas:

- `npm test`: **53 suites** (was 52), **668 tests** (was 648), **635 passing** (was 629 —
  the 6 new passes are this file's evidence and sanity probes), **29 failing** (was 15:
  5 pre-existing + 7 from task 2 + 3 from task 3 + **14 deliberate here**), 4 skipped
  (unchanged).
- `npm run typecheck`: **632 errors — unchanged.** `tests/**` is excluded from the
  typecheck scope; the new file was type-checked separately and is clean.

No regression. The 14 failures here are expected and must stay failing until task 9.1
lands.

## Open items for task 9.1 / 9.2

1. **Extend the doc edit list to five files**, not the two named in clause 1.2:
   `docs/RAZORPAY_FIX_CACHE.md`, `docs/RAZORPAY_TROUBLESHOOTING.md`,
   `docs/RAZORPAY_UPI_DEBUGGING.md`, `docs/RAZORPAY_UPI_APPS_NOT_SHOWING.md`,
   `docs/guides/RAZORPAY_INTEGRATION.md`.
2. **Fix `docs/guides/RAZORPAY_INTEGRATION.md:20-21`**, not ~185. Line 185 is already a
   placeholder; line 21 publishes a truncated secret.
3. **Delete the `extra.EXPO_PUBLIC_RAZORPAY_KEY_SECRET` entry entirely**, not just its
   fallback. All four env combinations ship a key secret today, so removing only the
   `|| "..."` default leaves clause 2.1 unmet.
4. **Grep a real APK once** at task 9.2, as the belt-and-braces check this suite explicitly
   does not perform.
5. **Redact the `XNC1LWew` prefix from this document** when task 9.1 removes it from
   `docs/guides/RAZORPAY_INTEGRATION.md:21`.

## A stale bundle cannot be misread at task 9.2

The export directories are gitignored but they persist on disk, so the obvious trap is
someone re-running this suite at task 9.2 against a bundle exported *before* the fix, seeing
the bundle assertion fail, and concluding the fix did not work.

The suite decides staleness exactly rather than by timestamp: a bundle exported from a tree
with no credential fallbacks cannot contain one, so "the tree is clean but the bundle is
not" means the bundle predates the fix. In that state the assertion is skipped with a loud
re-export instruction instead of failing. Timestamps are not usable for this — `git
checkout` rewrites an mtime without changing content, which is exactly what happened while
reverting the falsifiability sketch here.

Before the fix, as now, the tree is not clean, so the rule does not fire and the assertion
runs and fails. That is the 14th failure.
