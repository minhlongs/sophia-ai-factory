# Wave 5 Code Review — F-1 to F-8

**Date:** 2026-05-09 02:34
**Reviewer:** code-reviewer
**Scope:** 13 files, 1203 LOC. Tests 2810/2810 GREEN, tsc 0 errors, i18n 0 missing.
**Score:** **9.2 / 10** (target ≥9.0 met)

---

## Summary

Solid hardening sweep. All 8 features compile, test, and behave correctly. Sophia rules adhered (no `:any`, no banned imports, ≤200 LOC, kebab-case, no Polar usage, no console.*). Below: 0 critical, 4 high, 4 medium, 3 low. Most items are observability gaps and missing test assertions, not functional bugs.

---

## CRITICAL (0)

_None._

---

## HIGH (4)

### H-1 — F-2: Tests do NOT assert new timestamp behavior
**File:** `src/lib/webhooks/__tests__/sender.test.ts`
**Issue:** `sender.ts` now signs `${timestamp}.${body}` and emits `X-Sophia-Timestamp`. Existing tests only assert presence of `X-Sophia-Signature` and shape. A future refactor that drops the timestamp prefix would silently pass.
**Fix:** Add 2 assertions:
```ts
expect(headers['X-Sophia-Timestamp']).toMatch(/^\d{10}$/)
// And verify signature against `${ts}.${body}` not just body
```

### H-2 — F-2: Outbound webhook receivers will fail signature check (BREAKING — confirmed acceptable per task description)
**File:** `src/lib/webhooks/sender.ts:33`
**Issue:** Existing receivers (RaaS customers consuming Sophia outbound webhooks via `sendWebhook`) computed HMAC over `body`. New code signs `${timestamp}.${body}`. During canary, those receivers will reject deliveries with 401/403.
**Fix:** Three options, pick one:
- (a) Document the change in `docs/webhook-signature-format.md` + admin announcement before canary cuts over
- (b) Add a feature-flag env var `WEBHOOK_SIG_V2=false` to dual-sign during transition (emit BOTH `X-Sophia-Signature-V1` and `X-Sophia-Signature-V2`)
- (c) Accept breaking change as task confirms; ensure changelog entry + outbound tenant emails sent
**Note:** `sendWebhook` is called only from `/api/v1/webhooks/[id]/test/route.ts` and `lib/webhooks/emitter.ts`. Audit who consumes the emitter output before flipping switch.

### H-3 — F-7: Tier promotion does NOT update `tier` column
**File:** `src/app/api/admin/users/[id]/route.ts:51-74`
**Issue:** PATCH writes `plan: 'premium'` (lowercase) only. Schema (migration 0086) added a `tier TEXT` column on `subscriptions`. `getUserTier` (`src/seed/db/get-user-tier.ts:52`) **prefers** `tier` over `plan` when both present. If a user already had `tier='ENTERPRISE'` from a prior payment, then admin PATCH writes `plan='premium'`, then `getUserTier` returns ENTERPRISE not PREMIUM (stale).
**Fix:** Update both columns:
```ts
await db.from('subscriptions').update({
  plan,
  tier: parsed.data.tier,  // uppercase
  status: 'active',
  updated_at: now,
}).eq('id', existing.id);
// Insert path likewise
```

### H-4 — F-8: `/api/csp-report` has no body-size limit
**File:** `src/app/api/csp-report/route.ts:16`
**Issue:** `request.text()` reads entire body unbounded. Attacker can POST 100MB and force allocator pressure on the edge worker. Real CSP reports are <1KB.
**Fix:** Cap body via `Content-Length` header check or stream-with-limit (mirror `MAX_BODY_BYTES = 64 * 1024` pattern from `src/app/api/v1/sop/[installationId]/trigger/route.ts:26`):
```ts
const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
if (contentLength > 16_384) return new NextResponse(null, { status: 413 });
```

---

## MEDIUM (4)

### M-1 — F-7: Tier promotion is non-atomic (race risk)
**File:** `src/app/api/admin/users/[id]/route.ts:52-74`
**Issue:** SELECT-then-UPDATE-or-INSERT pattern. Two concurrent admin PATCHes for the same user, with no existing subscription, will each run SELECT (both find none) then both INSERT — duplicate rows.
**Fix:** D1 supports `INSERT ... ON CONFLICT(...) DO UPDATE`. Add a unique index on `subscriptions(user_id, status)` and use upsert. Or use `db.batch([...])` with idempotent SQL. Likelihood low (admin actions rare, single human in tab) but easy to fix.

### M-2 — F-2: Two divergent webhook signature schemes
**Issue:** Project now has TWO signature conventions:
- `lib/webhooks/signer.ts` (sender.ts) — header `X-Sophia-Signature: <hex>` + `X-Sophia-Timestamp: <unix>`
- `lib/sop/webhook-hmac.ts` — combined Stripe-style `X-Sophia-Signature: t=<unix>,v1=<hex>` (used by `/api/v1/sop/[installationId]/trigger`)
The F-2 sender.ts code comment claims "Stripe pattern" but does NOT use Stripe's combined-header format (it uses separate headers).
**Fix:** Pick ONE format and document it. Recommend Stripe combined format (already used by SOP) — fewer headers, easier replay protection. Update sender.ts to emit `X-Sophia-Signature: t=<ts>,v1=<hex>`.

### M-3 — F-5: `/dashboard/agents` duplicates `/dashboard/missions`
**File:** `src/app/[locale]/dashboard/agents/page.tsx`
**Issue:** New page wraps `<AgentTeamPanel />` only. `src/app/[locale]/dashboard/missions/page.tsx:59` already mounts the same component. Two routes render essentially the same content. Confusing UX, duplicate index in sitemap, SEO dilution.
**Fix:** Either (a) delete the new page and add a nav anchor `#agents` on missions page; or (b) extend agents page with stats / per-agent drill-down so it differs.

### M-4 — F-8: CSP test does not assert `report-uri` directive presence
**File:** `src/seed/security/content-security-policy-configuration.test.ts:50-67`
**Issue:** `requiredDirectives` array does not include `report-uri`. Only the count check (12→13) catches it indirectly. A future refactor that drops `report-uri` and adds another directive would silently pass.
**Fix:** Add `'report-uri'` to `requiredDirectives` and add explicit `expect(header).toContain('report-uri /api/csp-report')`.

---

## LOW (3)

### L-1 — F-7: PATCH /api/admin/users not rate-limited
**File:** `src/app/api/admin/users/[id]/route.ts`
**Issue:** No `withRateLimit` wrapper. Admin token compromise → unbounded DB write spam. Defensible (admin role check) but low cost to add.
**Fix:** Wrap PATCH with `withRateLimit(..., { config: { intervalMs: 60_000, maxRequests: 60 } })`.

### L-2 — F-8: `report-uri` is deprecated; add `report-to`
**Issue:** Modern browsers (Chrome 96+, Firefox) prefer `Reporting-Endpoints` + `report-to` over `report-uri`. Acceptable per task note, but coverage is incomplete. Long term: emit BOTH directives during transition.
**Fix:** Add `Reporting-Endpoints: csp-endpoint="/api/csp-report"` HTTP header in middleware response, and append `report-to csp-endpoint` to CSP. Keep `report-uri` for legacy browsers.

### L-3 — F-8: `/api/csp-report` lacks unit test
**Issue:** No test for `src/app/api/csp-report/route.ts`. Smoke test would verify 204 response shape and JSON parse fallback path.
**Fix:** Add `src/app/api/csp-report/route.test.ts` with 3 cases: valid JSON CSP report → 204; raw text body → 204; oversized body → 413 (after H-4 fix).

---

## Verified GREEN (positive observations)

| Check | Result |
|---|---|
| F-1: 18 Inngest functions registered (was 16) | ✅ Verified count, cron specs `0 * * * *` and `0 3 * * *` valid 5-field syntax |
| F-3: `withRateLimit` returns `T \| NextResponse` — handler signature compatible | ✅ Type compatible, no breakage |
| F-3: `Request → NextRequest` in campaigns/create — server-only change | ✅ HTTP clients unaffected (NextRequest extends Request) |
| F-4: status namespace 7 keys × 2 locales, parity confirmed | ✅ Both `en.json` and `vi.json` aligned |
| F-5: i18n keys `agent_team` + `task_feed` exist in both locales | ✅ EN/VI present |
| F-6: `listOfficialTemplates` returns rows without secrets | ✅ `SopTemplateRow` schema has no `webhookSecret` field; that lives only on `installation.customizations` |
| F-6: GET unwrapped (read-only), POST wrapped | ✅ Matches missions/route.ts pattern |
| F-7: `requireAdmin` enforces 401/403 RBAC correctly | ✅ Header-based session check |
| All files | ✅ ≤200 LOC, kebab-case, no `:any`, no banned imports, no Polar, no console.* |

---

## Recommended Action Order

1. **Before deploy:** H-2 (decide canary strategy for webhook breaking change) + H-3 (add `tier` column update — silent data corruption risk)
2. **Before deploy:** H-4 (csp-report DoS protection — 1-line fix)
3. **Within sprint:** H-1, M-1, M-2, M-4 (test coverage + race + signature scheme unification)
4. **Backlog:** M-3 (route dedup), L-1/L-2/L-3

---

## Unresolved Questions

1. Are there external RaaS customers consuming `sendWebhook`-emitted webhooks today? If so, H-2 is a hard requirement.
2. Should `/api/admin/users/[id]` audit-log the role/tier change? Currently logs via `logger.info` only; no DB audit row.
3. Does `getRollup`/`getActiveIncident`/`listResolvedIncidents` (F-4) handle empty/missing tables gracefully during ISR build phase? Try/catch in `getStatusData()` covers exceptions but not slow queries blocking build.
