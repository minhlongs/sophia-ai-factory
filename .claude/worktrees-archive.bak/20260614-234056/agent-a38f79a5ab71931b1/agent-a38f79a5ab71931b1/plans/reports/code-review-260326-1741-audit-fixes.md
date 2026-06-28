## Code Review: Security Audit Fixes

**Files**: middleware.ts, d1-query-builder.ts, onboarding/status, admin/provision, proposals/new, uptime-health-check, logger.ts
**Assessment**: Good security posture. A few issues remain.

### Critical

1. **SQL injection in D1QueryBuilder** — Column names (`f.col`, `o.col`, table names) are interpolated directly into SQL strings without sanitization. If any caller passes user-controlled column names, this is exploitable. Add an allowlist or regex check on column/table names.
   - Lines: d1-query-builder.ts:197, 235, 274, 309

2. **Rate limit memory leak** — `rateLimitMap` grows unbounded in middleware.ts. No cleanup of expired entries. On long-running edge workers, this leaks memory. Add periodic eviction (e.g., prune entries older than RATE_LIMIT_WINDOW_MS every N requests).

### High

3. **Cron auth bypass when CRON_SECRET is unset** — uptime-health-check/route.ts:44: `if (cronSecret && provided !== cronSecret)` — when `CRON_SECRET` env var is missing, anyone can call the cron endpoint. Should fail closed: return 503 if secret is not configured.

4. **console.error in onboarding/status** — Line 112 uses raw `console.error` instead of the structured `logger`. Inconsistent with the rest of the codebase; may leak stack traces in non-JSON format.

### Medium

5. **debitMcuBalance race condition** — d1-query-builder.ts:422-434: reads balance then updates in a batch, but the read + conditional check is not atomic. Two concurrent debits could both pass the balance check. Use `UPDATE ... WHERE balance >= ?` in a single statement instead.

6. **Missing input validation on admin/provision** — No Zod schema validation. `mcu_credits` accepts any number (negative values would reduce balance). Add `mcu_credits > 0` guard.

7. **DOMPurify on client only** — proposals/new/page.tsx imports DOMPurify at top level. This works since it's `"use client"`, but `caseStudies` field is not sanitized (missing from SafeProposalPreview). If that field exists in the response, it renders unsanitized.

### Positive

- Middleware derives `org_id` from JWT, not user-controllable header — good fix
- Admin GET endpoint properly checks admin role
- Structured logger with JSON output and serialization fallback
- Security headers (HSTS, nosniff, Permissions-Policy) applied globally
- X-Request-Id for distributed tracing

### Recommended Actions

1. Add column/table name allowlist to D1QueryBuilder
2. Add rate limit map eviction
3. Fail closed on missing CRON_SECRET
4. Replace console.error with logger in onboarding/status
5. Fix debit race condition with atomic UPDATE WHERE
6. Add Zod validation + positive number check to admin/provision
7. Sanitize `caseStudies` field in proposal preview
