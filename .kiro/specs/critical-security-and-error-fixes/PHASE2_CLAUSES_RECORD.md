# Phase 2 Clauses Satisfied by Removal

Per clause 2.15, this document records explicitly which requirements are satisfied by deleting the dead Next.js layer rather than repairing it, and why each is met.

## Decision

**Delete.** The investigation (see design.md, "Investigation: is the Next.js layer consumed by anything?") found:

- No deployment target (no `vercel.json`, no Dockerfile, no CI workflow)
- No build or dev script referencing `next build`, `next dev` or `next start`
- Five uninstalled dependencies (`next`, `jose`, `zod`, `ioredis`, `rate-limiter-flexible`)
- No reachable caller from the mobile app
- Both apparent consumers (`MonitoringDashboard.tsx`, `ENDPOINTS` in `components/ai/index.tsx`) are themselves dead code

Retaining the layer would mean adding dependencies and writing real auth, rate limiting and RBAC for endpoints nobody calls, with no delivered function.

## Clauses Satisfied by Removal

### 2.7 and 2.8 — Middleware rejection and rate limiting

**Requirement**: `securityMiddleware()` must reject invalid API keys (401) and rate-exceeded requests (429) instead of always returning `NextResponse.next()`.

**Satisfied by removal**: No middleware remains to no-op. The files `middleware/security.ts` and `middleware/auth.ts` are deleted. There is no code path that can report success while doing nothing.

### 2.9 — Monitoring endpoint authentication

**Requirement**: Endpoints under `pages/api/admin/monitoring/` must verify bearer token signatures, require an admin role, and return 401/403 for unauthorized callers.

**Satisfied by removal**: No monitoring endpoints remain. The files `pages/api/admin/monitoring/{security,errors,performance,status}.ts` are deleted. No security events, error logs or performance data can be returned to any caller.

### 2.10 through 2.14 — `middleware/auth.ts` defects

**Requirement 2.10**: No hardcoded `'your-secret-key'` fallback for `JWT_SECRET`.
**Requirement 2.11**: `NextRequest` imported exactly once (was duplicated: value import line 1, type import line 2).
**Requirement 2.12**: Rate limiter uses the correct class (`RateLimiterRedis`, not the non-existent `RateLimiter`).
**Requirement 2.13**: `hasAccess()` returns a boolean without throwing for any role, including ones absent from `protectedRoutes`.
**Requirement 2.14**: Rate limiter keys on a trustworthy identifier, not `request.ip` alone.

**Satisfied by removal**: No `middleware/auth.ts` remains. All five defects — the hardcoded secret fallback, the duplicate import, the wrong class name, the throwing `hasAccess` on unknown roles, and the `request.ip` keying — go with it. No code exists that could exhibit any of these behaviors.

### 2.16 — Encryption correctness

**Requirement**: Retained encryption code must use a proper 32-byte key (hex-decoded), fail at startup when `ENCRYPTION_KEY` is absent, and perform a correct GCM round-trip including auth tag handling.

**Satisfied by removal**: `config/security.ts` is deleted. Its `encrypt`/`decrypt` exports had **zero callers anywhere** in the codebase (the only importer was `middleware/security.ts`, also deleted). No retained code performs encryption, so there is no encryption path that can fail or produce unrecoverable output.

### 2.17 — AI chat endpoint authentication

**Requirement**: The AI chat endpoint must authenticate callers, derive `userId` from a verified token, apply per-user rate limiting, and type-check correctly.

**Satisfied by removal**: No AI chat endpoint remains. `pages/api/ai/chat.ts` is deleted. The app already calls its AI services directly via `services/azureAI/*` and `services/aiAgent/bedrockAIService` without routing through a Next.js API layer. No unauthenticated AI endpoint exists.

### 3.9 and 3.10 — Preservation of monitoring and AI chat for authenticated users

**Requirement 3.9**: Authenticated admin calls to monitoring endpoints continue to return data, *provided the Next.js layer is retained*.
**Requirement 3.10**: Authenticated user messages to the AI chat endpoint continue to return responses, *provided the endpoint is retained*.

**Satisfied vacuously**: Both clauses are explicitly conditioned on retention ("provided the Next.js layer is retained" / "provided the endpoint is retained"). Under the recommended deletion, the condition is false and the obligations do not apply. This is stated here rather than silently dropped, per clause 2.15's requirement for explicitness.

## Summary

| Clause | Mechanism | Status |
|--------|-----------|--------|
| 2.7 | No middleware to no-op | Satisfied |
| 2.8 | No middleware to no-op | Satisfied |
| 2.9 | No monitoring endpoints | Satisfied |
| 2.10 | No `middleware/auth.ts` | Satisfied |
| 2.11 | No `middleware/auth.ts` | Satisfied |
| 2.12 | No `middleware/auth.ts` | Satisfied |
| 2.13 | No `middleware/auth.ts` | Satisfied |
| 2.14 | No `middleware/auth.ts` | Satisfied |
| 2.16 | `config/security.ts` deleted, zero callers | Satisfied |
| 2.17 | No AI chat endpoint; app calls AI directly | Satisfied |
| 3.9 | Conditioned on retention; vacuous | Satisfied |
| 3.10 | Conditioned on retention; vacuous | Satisfied |
