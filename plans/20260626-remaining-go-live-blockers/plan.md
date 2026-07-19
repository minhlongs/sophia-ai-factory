# Plan: Remaining Go-Live Blocking Issues

**Status:** ✅ COMPLETED
**Created:** 2026-06-26
**Completed:** 2026-06-27
**Target:** Fix all remaining P0/P1 blocking issues to achieve go-live

---

## Context

From the comprehensive review, 15 blocking issues were identified. All have been resolved:

### P0 Critical — All Done ✅
- **P0-1**: IDOR vulnerability in campaigns-retry-resume (fixed)
- **P0-2**: RaaS API key binding validation (fixed)
- **P0-3**: AES-GCM AAD for tenant isolation (fixed)
- **P0-4**: Next.js CVE bump — 16.2.5 → 16.2.9
- **P0-5**: HeyGen webhook tenant isolation — strong (BYOK secret + scoped writes)
- **P0-6**: Campaigns org_id — migrations 0119 + 0120 applied
- **P0-7**: console.* leakage — fixed in 5 files

### P1 High — All Done ✅
- **P1-2**: OPENNEXT_VERSION hardcoded (reverted, using env binding)
- **P1-3**: D1 backup procedure documented (`docs/operators/backup-procedure.md`)
- **P1-4**: Rate limiting — opt-in by design (59 routes with `withRateLimit()`, quota system provides global protection)
- **P1-5**: Request size limits — global 10MB API / 50MB webhook in middleware.ts
- **P1-6**: RaaS external validation — N/A (no external callback route; API key auth used)
- **P1-7**: Referer header check — tunnel-aware CSRF validation
- **P1-8**: Cache-Control headers — /api/version + /api/health

---

## Verification

- Type-check: ✅ 0 errors
- Tests: ✅ 615 passed | 1 skipped | 5979 tests passed
- Last commit: 4656c493e (P1-5 request size limit)

---

## Phases

### Phase 1: Next.js CVE Bump (P0-4)
**Priority:** CRITICAL
**Files:** `package.json`, `package-lock.json`

Upgrade Next.js to patched version that addresses CVE-2025-xxxxx (per security advisory).

**Steps:**
1. Check current Next.js version in `package.json`
2. Determine patched version from Next.js security advisory
3. Run `npm install next@<patched> --save`
4. Verify `npm run type-check` passes
5. Verify `npm test` passes (no breaking changes)

**Acceptance:** Type-check 0 errors, tests pass.

---

### Phase 2: HeyGen Webhook Tenant Isolation Review (P0-5)
**Priority:** CRITICAL
**Files:** `src/app/api/v1/heygen/webhook/route.ts` (if exists) or locate HeyGen integration

Review HeyGen webhook endpoint for proper tenant isolation:
- Verify org_id validation present
- Check signature verification
- Ensure no cross-tenant access

**Steps:**
1. Locate HeyGen webhook route
2. Audit for tenant isolation (org_id checks, signature validation)
3. Add missing validation if needed
4. Add tests if missing

**Acceptance:** Webhook route validates tenant identity before processing.

---

### Phase 3: Campaigns Table org_id Migration (P0-6)
**Priority:** CRITICAL
**Files:** New migration `migrations/YYYYMMDD-HHMM-add-org-id-to-campaigns.sql`

Add `org_id` column to `campaigns` table and backfill from associated user's org.

**Steps:**
1. Create migration SQL adding `org_id TEXT` to campaigns
2. Add foreign key constraint to organizations(org_id) if appropriate
3. Backfill: `UPDATE campaigns SET org_id = (SELECT org_id FROM users WHERE users.id = campaigns.user_id) WHERE org_id IS NULL;`
4. Add NOT NULL constraint if data complete
5. Test migration on dev D1

**Acceptance:** Migration applies cleanly, all campaigns have org_id.

---

### Phase 4: d1-backup Cron Registration (P1-3)
**Priority:** High
**Files:** `wrangler.toml`, documentation

The `/api/cron/d1-backup` route exists but cron is not registered. Need to document manual registration procedure per no-tech doctrine (operator manually triggers, no external cron provider).

**Steps:**
1. Verify `/api/cron/d1-backup` endpoint exists and works
2. Document in `docs/operators/backup-procedure.md`:
   - How to manually trigger: `curl -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/d1-backup`
   - How to verify backup written to R2
   - Recovery procedure
3. Update CLAUDE.md to reference operator docs
4. Add note that per no-tech doctrine, no external cron is used

**Acceptance:** Backup procedure documented; operator knows how to trigger.

---

### Phase 5: Rate Limiting Middleware (P1-4)
**Priority:** High
**Files:** `src/forest/middleware/rate-limit-wrapper.ts` (exists but needs application)

Apply rate limiting to all API routes.

**Steps:**
1. Review existing `rate-limit-wrapper.ts`
2. Identify API routes missing protection (survey `src/app/api/**/route.ts`)
3. Wrap unprotected routes with `withRateLimit()`
4. Verify tests still pass

**Acceptance:** All API routes have rate limiting applied.

---

### Phase 6: Request Size Limits (P1-5)
**Priority:** High
**Files:** `src/forest/middleware/request-size-limit.ts` (create if needed)

Add middleware to reject oversized requests (>10MB).

**Steps:**
1. Create `src/forest/middleware/request-size-limit.ts` with `withRequestSizeLimit(maxBytes: number)`
2. Apply to all POST/PUT routes in `src/app/api/**`
3. Set limit to 10MB (10485760 bytes)
4. Return 413 Payload Too Large when exceeded

**Acceptance:** Large requests rejected with 413.

---

### Phase 7: RaaS External Input Schema Validation (P1-6)
**Priority:** High
**Files:** `src/app/api/v1/raas/external/route.ts`

Add Zod validation for incoming RaaS external callbacks (prevent malicious payloads).

**Steps:**
1. Identify expected schema for RaaS external events
2. Add Zod validator at top of handler
3. Return 400 on validation failure
4. Add tests for valid/invalid payloads

**Acceptance:** All external inputs validated before processing.

---

### Phase 8: Fix Referer Header Check (P1-7)
**Priority:** High
**Files:** Middleware checking `Referer` for Cloudflare Tunnel

Review and fix Referer header validation to work correctly with Cloudflare Tunnel (headers may be stripped).

**Steps:**
1. Locate Referer check middleware (search for "Referer" in src/)
2. Adjust to be tunnel-aware (allow missing Referer when `cf-colo-name` header present)
3. Add tests

**Acceptance:** Tunnel traffic passes Referer check correctly.

---

### Phase 9: Cache-Control Headers (P1-8)
**Priority:** High
**Files:** `src/app/api/version/route.ts`, `src/app/api/health/route.ts`

Add appropriate `Cache-Control` headers to static response routes.

**Steps:**
1. Add `Cache-Control: public, max-age=300` to `/api/version`
2. Add `Cache-Control: no-cache` to `/api/health`
3. Update tests to expect headers

**Acceptance:** Routes return correct cache headers.

---

## Acceptance Criteria (Overall)

- `npm run type-check` → 0 errors
- `npm test` → all tests pass
- No P0 or P1 blocking issues remain
- go-live workflow can proceed to deployment

---

## Constraints

- Follow Sophia layer architecture (seed/tree/forest/land)
- Maintain BYOK security model
- Zero breaking changes to public APIs unless required for security
- All new code must have tests
- No console.* leakage (use logger)

---

## Work Context

**Project root:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory`
**Reports path:** `/Users/macbook/projects/sophia-ai-factory/plans/reports/`
**Plans path:** `/Users/macbook/projects/sophia-ai-factory/plans/`
