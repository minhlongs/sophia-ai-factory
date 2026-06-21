# Deploy Guard Admin UI — Implementation Plan

**Created:** 2026-06-21  
**Status:** Planning  
**Tasks:** #88, #92, #47  
**Owner:** CTO + Frontend Team  
**Priority:** P1 (completes SOC 2 separation-of-duties UI)

---

## Overview

Complete the Deploy Guard system by building an admin UI for approval management, integrating with the existing `guard-deploy.js` script and 2-operator attestation system.

### Current State (Hook H)

- `scripts/deploy/guard-deploy.js` checks GitHub PR approvals, CI status, security alerts
- Pre-push hook runs guard check with `--dry-run`
- `deploy-with-sha.sh` enforces 2-operator attestation (HAMC-based)
- Deploy audit log POSTs to `/api/admin/audit/deploy`
- Admin has deploy-status page showing last SHA, cron health, services

### Gaps to Close

1. **No UI to view pending deployments** needing manual approval/attestation
2. **No UI for operators to attest** (currently CLI-only via env vars)
3. **No view of deploy guard decisions** (blocks, overrides, attestations)
4. **Pre-push hook** only shows dry-run output; no link to approval UI
5. **Missing database tables** to persist attestation records and override requests

---

## Acceptance Criteria

- [ ] Admin can view deployments pending attestation/approval
- [ ] Admin can approve/deploy with 1-click attestation (signs manifest)
- [ ] Admin can request emergency override with documented reason
- [ ] Audit trail shows all deploy guard actions (blocks, approvals, overrides)
- [ ] Pre-push hook failure includes link to approval UI
- [ ] All changes have tests (unit + integration)
- [ ] Documentation updated (admin ops guide)
- [ ] Build passes (`npm run build`), tests pass (`npm test`), type-check passes

---

## Phases

### Phase 1: Database Schema & Types

**Files to create:**
- `apps/sophia-ai-factory/migrations/0150_deploy_guard_approvals.sql`
- `apps/sophia-ai-factory/src/forest/deploy-guard/types.ts`

**Tables:**

```sql
-- Track deploy attempts and guard decisions
CREATE TABLE deploy_guard_approvals (
  id TEXT PRIMARY KEY,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  operator_host TEXT NOT NULL,
  operator_user TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending' | 'approved' | 'rejected' | 'overridden'
  attestation_count INTEGER DEFAULT 0,
  required_attestations INTEGER DEFAULT 2,
  skip_attestation BOOLEAN DEFAULT 0,
  skip_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER -- optional TTL for pending entries
);

-- Track individual operator attestations
CREATE TABLE deploy_attestations (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL,
  operator_id TEXT NOT NULL, -- user ID from auth
  signature TEXT NOT NULL, -- HMAC-SHA256 signature
  operator_host TEXT NOT NULL,
  signed_at INTEGER NOT NULL,
  FOREIGN KEY (approval_id) REFERENCES deploy_guard_approvals(id) ON DELETE CASCADE
);

-- Emergency override audit
CREATE TABLE deploy_overrides (
  id TEXT PRIMARY KEY,
  commit_sha TEXT NOT NULL,
  requested_by TEXT NOT NULL, -- operator user ID
  reason TEXT NOT NULL,
  approved_by TEXT, -- senior operator (optional)
  created_at INTEGER NOT NULL
);
```

**Indexes:**
```sql
CREATE INDEX idx_deploy_guard_approvals_status ON deploy_guard_approvals(status);
CREATE INDEX idx_deploy_guard_approvals_commit ON deploy_guard_approvals(commit_sha);
CREATE INDEX idx_deploy_attestations_approval ON deploy_attestations(approval_id);
```

---

### Phase 2: Forest Module — Deploy Guard Service

**Directory:** `src/forest/deploy-guard/`

**Files:**
- `index.ts` — barrel export
- `approval-service.ts` — core logic: create approval, attest, approve, override
- `attestation-verifier.ts` — verify HMAC signatures
- `audit-logger.ts` — write audit entries (extend existing)
- `manifest-generator.ts` — create deploy manifest for signing

**Responsibilities:**
- Generate approval requests when deploy starts
- Verify attestation signatures
- Check if deployment is allowed (quorum reached)
- Record all actions in database
- Emit events for monitoring (optional)

**Integration with `deploy-with-sha.sh`:**
- Before attestation step, POST to `/api/admin/deploy-guard/create-approval` to create approval record
- After attestation verification, PATCH `/api/admin/deploy-guard/attest` to record operator signature
- If override needed, POST to `/api/admin/deploy-guard/request-override`
- After deploy, PATCH status to 'approved' or 'overridden'

---

### Phase 3: Admin API Endpoints

**Directory:** `src/app/api/admin/deploy-guard/`

**Endpoints:**

#### `GET /api/admin/deploy-guard/pending`
- List pending approvals (status='pending', not expired)
- Filters: branch, created after, created before
- Response: `{ approvals: Array<ApprovalDto> }`

#### `GET /api/admin/deploy-guard/approvals/:id`
- Get single approval details with attestations
- Response: `{ approval: ApprovalDetailDto, attestations: Array<AttestationDto> }`

#### `POST /api/admin/deploy-guard/attest`
- Body: `{ approvalId: string; signature: string }`
- Verify signature against manifest, record attestation
- If quorum reached, mark approval as approved
- Response: `{ success: true; remaining: number }`

#### `POST /api/admin/deploy-guard/override`
- Body: `{ commitSha: string; reason: string }`
- Create override record, bypass guard checks
- Response: `{ override: OverrideDto }`

#### `GET /api/admin/deploy-guard/history`
- Audit log of recent deploy guard decisions (last 30 days)
- Pagination: cursor-based
- Response: `{ entries: Array<HistoryDto>; nextCursor?: string }`

#### `POST /api/admin/deploy-guard/create-approval` (internal)
- Called by `deploy-with-sha.sh` at deploy start
- Body: `{ commitSha, branch, operatorHost, operatorUser, diffSummary, filesChanged }`
- Creates pending approval record
- Response: `{ approvalId: string }`

All endpoints require `requireAdmin()` middleware.

---

### Phase 4: React UI — Admin Approval Dashboard

**Directory:** `src/app/[locale]/dashboard/admin/deploy-guard/`

**Files:**
- `page.tsx` — main page listing pending approvals
- `approval-detail-modal.tsx` — detail view + attestation button
- `history-table.tsx` — audit log table
- `components/` — shared components if needed

**Features:**

#### Pending Approvals Page
- Table: Commit SHA, Branch, Operator, Files Changed, Created At, Status
- Actions: "Attest" button (opens modal), "Override" button
- Auto-refresh every 30s (long polling or SWR)
- Badge: "Needs N more attestations"

#### Attestation Modal
- Shows manifest details (commit, branch, operator, timestamp, diff summary)
- "Sign and Attest" button — triggers HMAC with operator's DEPLOY_KEY
- After signing, POST to attest endpoint
- Success: shows remaining attestations needed or "Deploy Approved"

#### Override Modal
- Text input for reason (required)
- Confirmation dialog
- POST to override endpoint
- Bypasses all checks (audited)

#### History Page (tab or separate page)
- Table: Date, Commit, Action (approved/blocked/overridden), Operators, Reason
- Filters: date range, action type
- Export CSV button

**State Management:**
- Use `useState` + `useEffect` for polling
- Or SWR for data fetching with revalidation
- Optimistic updates on attestation/override

**i18n:** Vietnamese + English (follow existing admin patterns)

---

### Phase 5: Update Pre-Push Hook

**File:** `.git/hooks/pre-push`

**Changes:**
- When guard check fails, print message with URL:  
  `"Deploy guard blocked: <reason>. View/manage at https://sophia.agencyos.network/dashboard/admin/deploy-guard"`
- If `--dry-run` and no PR found, mention attestation requirement and link

**Why:** Operators see immediately where to go to fix block.

---

### Phase 6: Integrate with `deploy-with-sha.sh`

**File:** `apps/sophia-ai-factory/scripts/deploy-with-sha.sh`

**Changes:**
1. **Before attestation step** (around line 170):
   - Call `POST /api/admin/deploy-guard/create-approval` with manifest data
   - Store returned `approvalId` in variable
   - If fails (non-fatal?), log warning but continue (or abort?)

2. **After attestation verification** (around line 198-212):
   - For each valid attestation, `POST /api/admin/deploy-guard/attest` with signature
   - Include `approvalId` and `signature`
   - If approval reaches quorum, proceed; if not, continue waiting or fail?

3. **If SKIP_ATTESTATION=1** (around line 214):
   - `POST /api/admin/deploy-guard/override` with reason "Emergency bypass: SKIP_ATTESTATION"

4. **After deploy completes** (around line 519):
   - `PATCH /api/admin/deploy-guard/:id/status` to 'approved' (or 'overridden')
   - Include final deploy metadata (SHA, timestamp)

**Integration contract:**
- API must be idempotent (deploy may retry)
- All calls non-fatal by default? Better: fatal if approval creation fails (abort deploy)
- Use curl with `-f` to fail on non-2xx

---

### Phase 7: Tests

**Unit tests:** `src/forest/deploy-guard/__tests__/`
- `approval-service.test.ts` — create, attest, quorum logic, override
- `attestation-verifier.test.ts` — HMAC verification, edge cases
- `manifest-generator.test.ts` — deterministic manifest generation

**Integration tests:** `src/app/api/admin/deploy-guard/__tests__/`
- `create-approval.test.ts` — creates pending record
- `attest.test.ts` — records attestation, quorum triggers approval
- `override.test.ts` — creates override, allows bypass
- `history.test.ts` — pagination, filters

**E2E (optional):** Playwright test that simulates:
- Operator attestation flow through UI
- Override request flow

**Test coverage:** >90% of new code

---

### Phase 8: Documentation

**Update:**
- `docs/admin-ops/deploy-guard-sop.md` — Standard Operating Procedure for operators
  - How to attest via UI
  - How to request override
  - 2-operator workflow (who attests first, who second)
  - Emergency procedures
- `apps/sophia-ai-factory/README.md` (if needed) — mention new admin page
- `CLAUDE.md` (if needed) — reference deploy guard admin UI

**i18n:** Vietnamese + English

---

## Implementation Order

1. Phase 1: Database migration + types (foundational)
2. Phase 2: Forest service (business logic)
3. Phase 3: API endpoints (expose to UI)
4. Phase 4: React UI (visible to operators)
5. Phase 5: Pre-push hook update (UX improvement)
6. Phase 6: deploy-with-sha.sh integration (make system complete)
7. Phase 7: Tests (verify correctness)
8. Phase 8: Documentation (handover to ops)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Attestation HMAC mismatch between CLI and UI | Use same crypto library (Node `crypto` vs Web Crypto API) — write shared utility in `seed/utils/` |
| Race condition: two operators attest simultaneously | DB transaction or atomic update (SELECT FOR UPDATE not needed if idempotent retry) |
| Deploy blocked if API unavailable | Non-fatal logging + retry logic; emergency bypass `SKIP_ATTESTATION=1` still works |
| UI exposes sensitive deploy data | Require admin auth (`requireAdmin()` already in place) |
| Migration fails on existing D1 DB | Test migration on staging first; use `IF NOT EXISTS`; rollback plan |

---

## Rollback Plan

- **Database migration:** reversible DROP TABLE IF EXISTS (keep old guard script as fallback)
- **API endpoints:** disable by removing routes; existing deploy script still works with CLI-only attestation
- **UI:** remove page; operators revert to CLI workflow
- **pre-push hook:** keep existing dry-run message (no link)

---

## Success Validation

1. `npm run build` passes with 0 TypeScript errors
2. `npm test` passes all new tests (no regressions)
3. Manual smoke: simulate deploy, create approval, attest via UI, deploy succeeds
4. Pre-push hook shows link to approval UI when blocked
5. Deploy-with-sha.sh creates approval record, UI shows pending
6. Two operators can attest via UI, quorum reached
7. Override flow works, deploy not blocked
8. Audit log shows all actions with timestamps

---

## Related Files

Existing:
- `scripts/deploy/guard-deploy.js` — pre-push guard check
- `scripts/deploy-with-sha.sh` — main deploy script with attestation
- `.git/hooks/pre-push` — calls guard-deploy.js --dry-run
- `src/app/[locale]/dashboard/admin/deploy-status/` — existing status page

To be created:
- `src/forest/deploy-guard/` — forest module
- `src/app/api/admin/deploy-guard/` — admin APIs
- `src/app/[locale]/dashboard/admin/deploy-guard/` — UI pages
- `apps/sophia-ai-factory/migrations/0150_deploy_approvals.sql`

---

## Effort Estimate

- Database design + migration: 0.5 day
- Forest service: 1 day
- API endpoints (5 endpoints): 1 day
- React UI (3 pages + components): 2 days
- Integration with deploy script: 0.5 day
- Tests (unit + integration): 1 day
- Documentation: 0.5 day
- **Total:** 6.5 person-days

---

*End of Plan*
