# Phase 01 — SOC 2 Type I Preparation

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (Security category)
- Audit framework: `~/.claude/rules/on-demand/actual-fullstack-audit.md` (L3 Security, L6 Compliance)
- Related: Phase 4 (Key Rotation) depends on this phase's SoD controls

## Overview

- **Priority:** P0 (gating for Milestone B)
- **Status:** completed (implementation)
- **Report status:** pending auditor engagement
- **Description:** Prepare Sophia for SOC 2 Type I audit by implementing immutable audit logging, separation-of-duties controls, incident response runbook, and quarterly access review processes. This phase establishes the compliance foundation.

## Key Insights

- SOC 2 Type I audits **system design** at a point in time; Type II audits **operational effectiveness** over 6-12 months
- The 8 P0 fixes (Wave A/B/C) addressed security CVEs but did not establish audit trails or access controls
- Current state: No immutable audit log table, single-operator deploy capability, no documented incident response roles
- Success criterion: Audit firm signs off on Type I report (can begin Type II observation period)

## Requirements

### Functional
1. **Immutable audit log table** — All sensitive operations (deploys, key accesses, data exports, privilege changes) must write to an append-only `audit_log` table with cryptographic hash chain
2. **Separation-of-duties on deploy** — No single human can deploy to production without second-party approval (GitHub PR + at least 1 approver, OR two-operator manual handoff)
3. **Incident response runbook** — Documented roles (who declares Sev-1, who pages, who comms), communication channels, SLA targets, blameless retro template
4. **Quarterly access review process** — Automated report of all users with admin/operator privileges; documented approval for continued access
5. **Vendor SOC 2 tracking** — Collect and assess Cloudflare, Sentry, NOWPayments SOC 2 reports; maintain vendor register

### Non-functional
- Audit log writes must be < 50ms overhead
- Hash chain verification must be runnable as daily/weekly integrity check
- All runbooks stored in `docs/runbooks/` with bilingual (EN+VI) summaries
- No manual steps that require operator memory — all procedures scripted or checklisted

## Architecture

### Immutable Audit Log Table

```sql
-- migrations/0121-audit-log-table.sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  occurred_at INTEGER NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_type TEXT NOT NULL, -- 'user' | 'system' | 'operator'
  action TEXT NOT NULL, -- e.g., 'deploy', 'key_access', 'data_export', 'privilege_change'
  resource_type TEXT NOT NULL, -- e.g., 'deployment', 'api_key', 'user'
  resource_id TEXT NOT NULL,
  details_json TEXT NOT NULL, -- JSON with operation-specific fields
  previous_hash TEXT NOT NULL, -- hash of previous row (chain)
  current_hash TEXT NOT NULL, -- hash(id+occurred_at+actor+action+resource+details+previous_hash)
  signature TEXT -- optional: operator signature if human-initiated
);

CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
```

**Hash chain integrity:** Each row's `current_hash` includes the previous row's `current_hash`. Periodic verification script (`scripts/audit/verify-hash-chain.js`) walks the chain and reports any breaks.

**Instrumentation locations:**
- `deploy-with-sha.sh` — write `deploy` action with SHA, deployer identity
- `src/seed/auth/better-auth-session.ts` — write `privilege_change` on role changes
- `src/app/api/admin/*` — write `data_export` for admin data exports
- `src/tree/credentials/*` — write `key_access` on BYOK key read/decrypt

### Separation-of-Duties Deploy Guard

Current problem: `deploy-with-sha.sh` runs from operator's M1 MacBook with no second-party approval.

**Solution:** Require one of:
1. GitHub PR with ≥1 approver (preferred)
2. Two-operator manual handoff (backup) — operator A prepares, operator B approves and runs deploy

**Implementation:**
- Add `scripts/deploy/guard-deploy.js` that checks:
  - If `GITHUB_ACTION` environment (GitHub Actions) — blocked by doctrine (disabled)
  - If `ALLOW_UNPUSHED_DEPLOY` set — requires `--force` flag + log entry
  - If deploying from non-main branch — blocked
  - If no PR approval (query GitHub API) — blocked unless `--override` with reason
- Update `package.json` `deploy:full` script to run guard before `wrangler deploy`
- Add pre-push hook that fails if `deploy-with-sha.sh` would fail guard check

### Incident Response Runbook

Create `docs/runbooks/INCIDENT_RESPONSE.md` with:

1. **Severity matrix** — Sev-1 (full outage), Sev-2 (partial), Sev-3 (degraded), Sev-4 (minor)
2. **Role assignments** — Incident Commander, Communications Lead, Technical Lead, Scribe
3. **Communication channels** — Telegram operator group, customer status page URL, escalation contacts
4. **Initial response checklist** (first 15 minutes):
   - Acknowledge alert
   - Declare severity
   - Assemble war room
   - Page on-call if needed
   - Post initial status to status page
5. **Runbook index** — link to specific runbooks for common incidents:
   - `docs/runbooks/D1-OUTAGE.md`
   - `docs/runbooks/PAYMENT-WEBHOOK-FAILURE.md`
   - `docs/runbooks/INNGEST-QUEUE-BACKLOG.md`
6. **Post-incident template** — blameless retro within 48h, action items tracked

### Quarterly Access Review

Automated script `scripts/security/quarterly-access-review.js` that:
- Queries all users with roles: `admin`, `operator`, `compliance`
- Exports to CSV with: user_id, email, role, last_login, permissions_granted_date
- Requires documented approval (PR) to retain access
- Runs automatically every quarter; results committed to `docs/security/access-reviews/Q<quarter>-<year>.md`

### Vendor SOC 2 Tracking

Create `docs/compliance/VENDOR-SOC2.md` with table:

| Vendor | Service | SOC 2 Type | Report Date | Coverage Scope | Assurance |
|---|---|---|---|---|---|
| Cloudflare | Workers/D1/R2 | Type II | 2026-03 | All services | Full |
| Sentry | Error monitoring | Type II | 2026-04 | SaaS platform | Full |
| NOWPayments | Crypto payments | Type I | 2026-01 | Payment processing | Partial |

**Process:** Update annually or when adding new vendor.

## Related Code Files

**Files to create:**
- `migrations/0121-audit-log-table.sql`
- `scripts/audit/verify-hash-chain.js`
- `scripts/deploy/guard-deploy.js`
- `scripts/security/quarterly-access-review.js`
- `docs/runbooks/INCIDENT_RESPONSE.md`
- `docs/security/access-reviews/` (directory for quarterly reports)
- `docs/compliance/VENDOR-SOC2.md`

**Files to modify:**
- `package.json` — add `deploy:guard` script
- `deploy-with-sha.sh` — insert guard check before `wrangler deploy`
- `.husky/pre-push` — add guard dry-run check
- `src/seed/auth/better-auth-session.ts` — add audit log helper
- Various action handlers to inject audit logging

## Implementation Steps

1. **Design review** — Get SOC 2 auditor feedback on proposed audit log schema (skip if auditor not yet selected; otherwise validate)
2. **Create audit_log table migration** — `0121-audit-log-table.sql` + test migration on staging
3. **Implement audit log library** — `src/lib/audit/audit-logger.ts` with `logAction()` function; hash chain logic
4. **Instrument deploy script** — add audit write on deploy; integrate guard
5. **Implement guard-deploy.js** — PR approval check via GitHub API, two-operator approval check
6. **Update pre-push hook** — run guard dry-run; fail if guard would block deploy
7. **Create incident response runbook** — document roles, channels, SLAs, templates
8. **Implement quarterly access review script** — export CSV; create PR template for approval
9. **Collect vendor SOC 2 reports** — download from vendor trust centers; populate VENDOR-SOC2.md
10. **Internal dry-run audit** — simulate auditor interview; walk through controls
11. **Engage SOC 2 auditor** — send controls documentation; schedule kickoff
12. **Address auditor feedback** — iterate on gaps identified
13. **Type I report issuance** — obtain report (typically 4-6 weeks after auditor engagement)

## Todo List

- [ ] Research and select SOC 2 Type I auditor (budget: ~$5-15k)
- [ ] Draft audit log schema and get preliminary auditor feedback
- [ ] Write and test `0121-audit-log-table.sql` migration on staging
- [ ] Implement `src/lib/audit/audit-logger.ts` with hash chain
- [ ] Instrument `deploy-with-sha.sh` with audit write
- [ ] Implement `scripts/deploy/guard-deploy.js` with PR approval + two-operator checks
- [ ] Update pre-push hook to run guard dry-run
- [ ] Create `docs/runbooks/INCIDENT_RESPONSE.md` with severity matrix and roles
- [ ] Implement `scripts/security/quarterly-access-review.js`
- [ ] Collect vendor SOC 2 reports and populate `docs/compliance/VENDOR-SOC2.md`
- [ ] Conduct internal controls walkthrough
- [ ] Engage auditor and begin Type I assessment
- [ ] Address auditor findings iteratively
- [ ] Receive SOC 2 Type I report

## Success Criteria

- ✅ `audit_log` table exists with >100 rows from recent deploys/operations
- ✅ Hash chain verification script runs without errors on production data
- ✅ `deploy-with-sha.sh` fails without PR approval (unless `--override` with documented reason)
- ✅ Pre-push hook blocks pushes that would fail guard
- ✅ Incident response runbook published with clear roles and SLAs
- ✅ Quarterly access review script produces CSV; first review PR approved
- ✅ Vendor SOC 2 table populated with at least 3 major vendors
- ✅ SOC 2 Type I report obtained (PDF in `docs/compliance/soc2-type1-report.pdf`)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Auditor requires schema changes mid-process | High | Med | Engage auditor early; build iteration buffer |
| Hash chain performance overhead >50ms | Low | Med | Benchmark; batch writes if needed |
| Guard blocks legitimate emergency deploys | Med | High | `--override` with audit trail; incident ticket required |
| Two-operator approval delays releases | Med | Low | Set SLA for approval (2h during business hours) |
| Vendor SOC 2 reports not publicly available | Med | Low | Request NDA-covered reports or use alternative attestations |

## Security Considerations

- **Audit log tampering prevention:** Hash chain makes retroactive modification detectable (would break chain). Do NOT allow DELETE on `audit_log` rows.
- **Actor identity:** Deploy guard must positively identify operator via GitHub SSO or CLI auth token
- **Guard bypass logging:** All `--override` uses must write to `deploy_override_log` separate table for audit
- **Least privilege:** Quarterly access review must actively revoke unused privileges

## Next Steps

1. **Immediate:** Select SOC 2 auditor (get recommendations; compare bids)
2. **Week 1-2:** Build audit log + deploy guard
3. **Week 3-4:** Instrument core operations; create runbooks
4. **Week 5-6:** Internal dry-run; auditor kickoff
5. **Week 7-10:** Address findings; receive Type I report
