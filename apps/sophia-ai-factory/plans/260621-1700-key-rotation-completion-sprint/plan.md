# Key Rotation Completion Sprint — Tasks #67, #55, #57-59, #60, #62-63, #65

**Created:** 2026-06-21
**Status:** In Progress
**Priority:** P0 (Security infra)
**Work Context:** /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
**Reports:** /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/plans/reports/

## Overview

Complete the key rotation infrastructure that is partially implemented but not production-ready. This sprint focuses on:
1. Audit logging integration (missing)
2. Comprehensive testing (missing)
3. Tree→forest architectural violations (blocking clean architecture)
4. Production runbook and execution

## Current State Analysis

### Already Implemented ✅
- Migration 0184: `key_versions` table + `key_version` columns on 3 tables
- BYOK crypto with dual-decrypt support (24h window)
- Inngest `key-rotation-reencrypt` job (batch processing)
- Admin API `POST /api/admin/keys/rotate`
- Audit logging infrastructure (`audit_log` table, `audit-logger` module)

### Missing / Incomplete ❌
- Rotation API not logging to `audit_log`
- Re-encrypt job not logging to `audit_log`
- No end-to-end rotation tests
- No staging rotation test documented
- No production runbook
- Tree→forest import violations (multiple files)

## Task Breakdown

### Task 1: Fix Tree→Forest Violations (#67)
**Priority:** P1 (Architecture hygiene)
**Dependencies:** None

**Problem:** Tree layer imports from forest (forbidden by 4-layer architecture)

**Violations found:**
```
src/tree/publishing/credential-manager.ts → @/forest/publishing/platform-adapter
src/tree/publishing/providers/telegram-publisher.ts → @/forest/publishing/providers/telegram-publisher
src/tree/openclaw/index.ts → @/forest/openclaw/spawn-agent-fleet
src/tree/sop/executor/sop-runner.ts → @/forest/missions/dispatcher
src/tree/alerts/index.ts → references @/forest/alerts/quota/alert-rule-evaluator
src/tree/alerts/quota-alert-service.ts → references @/forest/alerts/quota/alert-rule-evaluator
src/tree/telegram/__tests__/dispatch-with-retry-hints.test.ts → @/forest/publishing/providers/telegram-publisher
src/tree/affiliates/scout/writer.ts → @/forest/webhooks
src/tree/usage-metering/tracker-db-helpers.ts → @/forest/raas-schema, @/forest/quota/quota-checker-kv-cache, @/forest/usage-metering/realtime-tracker-kv-ops
src/tree/quota/quota-api-helpers.ts → @/forest/usage-metering/types
src/tree/quota/channel-cooldown.ts → @/forest/publishing/publisher-interface
src/tree/quota/quota-checker-db.ts → @/forest/usage-metering/aggregator, @/forest/usage-metering/types
src/tree/quota/quota-checker-overage.ts → @/forest/alerts/realtime-alert-service, @/forest/usage-metering/types
src/tree/email/missions/campaign-run.ts → @/forest/leads/missions/lead-find, @/forest/missions/types
src/tree/email/missions/email-test.ts → @/forest/missions/types
src/tree/email/missions/email-campaign.ts → @/forest/missions/types
src/tree/email/missions/email-templates.ts → @/forest/missions/types
```

**Strategy:**
- For type-only imports: Move types to `seed/types/` or create barrel re-exports in seed
- For value imports: Invert dependency (forest→tree is allowed for orchestration) OR extract to seed
- Goal: Zero `from '@/forest'` imports in tree layer

**Files to modify:**
- `src/tree/publishing/credential-manager.ts`
- `src/tree/publishing/providers/telegram-publisher.ts`
- `src/tree/openclaw/index.ts`
- `src/tree/sop/executor/sop-runner.ts`
- `src/tree/alerts/index.ts`
- `src/tree/alerts/quota-alert-service.ts`
- `src/tree/telegram/__tests__/dispatch-with-retry-hints.test.ts`
- `src/tree/affiliates/scout/writer.ts`
- `src/tree/usage-metering/tracker-db-helpers.ts`
- `src/tree/quota/quota-api-helpers.ts`
- `src/tree/quota/channel-cooldown.ts`
- `src/tree/quota/quota-checker-db.ts`
- `src/tree/quota/quota-checker-overage.ts`
- `src/tree/email/missions/campaign-run.ts`
- `src/tree/email/missions/email-test.ts`
- `src/tree/email/missions/email-campaign.ts`
- `src/tree/email/missions/email-templates.ts`

### Task 2: Audit Logging Integration (#63)
**Priority:** P1 (Security)
**Dependencies:** Task 1 (optional but good to coordinate)

**Problem:** Key rotation actions must be logged to `audit_log` for SOC 2 compliance

**Required integrations:**
1. **Admin rotation API** (`src/app/api/admin/keys/rotate/route.ts`)
   - Log `action: 'key.rotation.requested'`
   - Include: `keyVersion`, `reason`, `userId` (actor)
   - Use: `logAuditEvent()` from `@/tree/audit/audit-logger`

2. **Inngest re-encrypt job** (`src/forest/inngest/functions/key-rotation-reencrypt.ts`)
   - Log `action: 'key.rotation.reencrypt.start'` at beginning
   - Log `action: 'key.rotation.reencrypt.complete'` at end
   - Include: `keyVersion`, `total`, `userApiKeys`, `providerCredentials`, `platformCredentials`
   - Log per-batch progress as `action: 'key.rotation.reencrypt.batch'` (debug level)
   - Use: `logAuditEvent()` from `@/tree/audit/audit-logger`

**Files to modify:**
- `src/app/api/admin/keys/rotate/route.ts`
- `src/forest/inngest/functions/key-rotation-reencrypt.ts`

### Task 3: End-to-End Rotation Tests (#62)
**Priority:** P1 (Quality gate)
**Dependencies:** Task 2

**Problem:** Need test coverage for rotation flow on staging

**Test requirements:**
1. Unit test: `getActiveKeyVersion()` returns correct version
2. Unit test: Dual-decrypt with version 1 and 2
3. Integration test: Rotation API → job → re-encryption
4. Staging smoke test: Script to trigger rotation and verify 100 keys rotated

**Files to create:**
- `src/tree/byok/key-rotation.test.ts` — unit + integration tests
- `scripts/test/rotation-staging-smoke.js` — manual staging test

**Files to modify:**
- `src/app/api/admin/keys/rotate/route.ts` — ensure testability (export helper functions)

### Task 4: Production Rotation Runbook (#65)
**Priority:** P1 (Operations)
**Dependencies:** Task 2, Task 3

**Problem:** Operators need documented procedure to execute rotation in production

**Runbook sections:**
1. Pre-rotation checklist
   - [ ] Backup DB (`wrangler d1 export`)
   - [ ] Verify audit logging active (`SELECT 1 FROM audit_log LIMIT 1`)
   - [ ] Notify team (Slack #eng-infra)
   - [ ] Schedule maintenance window (if user-scoped, notify affected users)

2. Rotation execution
   - `POST https://sophia.agencyos.network/api/admin/keys/rotate` with body `{"reason": "scheduled rotation"}`
   - Monitor Inngest dashboard for job progress
   - Watch logs: `wrangler tail` for `[key-rotation]`

3. Verification
   - Spot-check: `SELECT key_version FROM user_api_keys LIMIT 10;` (should be new version)
   - Test decryption: Pick a rotated key, verify it decrypts
   - Check audit log: `SELECT * FROM audit_log WHERE action='key.rotation.*'`

4. Rollback
   - If errors > threshold: Do nothing — old version still active (dual-decrypt window)
   - To halt early: `curl -X POST https://api.inngest.com/...` (cancel job)

5. Post-rotation
   - After 24h: `UPDATE key_versions SET is_active=0 WHERE version=<old> AND rotated_at IS NOT NULL;`
   - Archive old version data to R2 (optional)

**File to create:**
- `docs/runbooks/KEY-ROTATION.md`

### Task 5: Verify Migration 0184 Application
**Priority:** P1 (Data integrity)
**Dependencies:** None (but must be done before rotation)

**Problem:** Migration 0184 exists but need to verify it's applied on all environments

**Steps:**
1. Check if migration is in `migrations/` directory (✅ exists)
2. Verify schema matches expectation (run on staging)
3. Create data migration script to backfill `key_version=1` for existing rows
4. Test migration on staging copy

**Files to check:**
- `migrations/0184_key_versions.sql` (already exists)

**Files to create:**
- `scripts/migrations/backfill-key-versions.ts` (if needed)

## Implementation Order

**Week 1 (June 21-22):**
1. Day 1 AM: Fix tree→forest violations (Task 1)
2. Day 1 PM: Audit logging integration (Task 2)
3. Day 2: Write rotation tests (Task 3)

**Week 2 (June 23-24):**
4. Day 3: Create production runbook (Task 4)
5. Day 4: Verify migration 0184 + backfill script (Task 5)
6. Day 5: Test on staging end-to-end

**Week 3 (June 25-27):**
7. Execute first production rotation (Task 5) — low-risk test user

## Success Criteria

- ✅ Zero tree→forest import violations (grep `@/forest` in src/tree returns empty)
- ✅ Rotation API logs to audit_log with correct action/metadata
- ✅ Re-encrypt job logs start/complete to audit_log
- ✅ All rotation tests pass (npm test)
- ✅ Staging rotation smoke test passes (script exits 0)
- ✅ Runbook documented and reviewed by second operator
- ✅ Migration 0184 applied on staging + production
- ✅ First production rotation executed successfully (test user)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tree→forest fixes break existing functionality | Med | High | Fix incrementally, run full test suite after each file |
| Audit logging slows rotation job | Low | Med | Use `step.run()` for async audit writes, batch where possible |
| Migration 0184 not applied on production | Low | High | Verify via `wrangler d1 execute` before rotation |
| Re-encrypt job times out (Inngest 60s) | Med | Med | Already uses batching (250) + `step.run()` — should be fine |
| Dual-decrypt window misconfigured | Low | High | Verify code: 24h window, test both versions decrypt |

## Related Work Streams

- **Phase 1 SOC 2:** Audit logging integration aligns with SoD controls
- **BYOK Phase 4G:** This completes the key rotation capability
- **Enterprise Gap Closure:** Part of `260617-1234-enterprise-gap-closure` plan

## Notes

- All code changes must follow 4-layer architecture (seed/tree/forest/land)
- Maintain backward compatibility: dual-decrypt window ensures no downtime
- Tests must pass: `npm test` (1400+ tests)
- Build must pass: `npm run build` (0 TS errors)
- No `:any` types allowed
- All changes must be bilingual (Vietnamese + English) in customer-facing docs
