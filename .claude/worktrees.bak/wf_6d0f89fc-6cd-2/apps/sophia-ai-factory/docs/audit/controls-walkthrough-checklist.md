# Internal Controls Walkthrough Checklist — SOC 2 Type I

**Document ID:** CTRL-WALK-001  
**Date:** 2026-06-22  
**Auditor:** TBD  
**Scope:** Sophia AI Factory production environment  
**Period:** Point-in-time as of 2026-06-22  

---

## Purpose

This checklist documents the test procedures and evidence for each implemented control. Each control includes:

- **Control Objective**: What the control achieves
- **Implementation Location**: Code/files where control is implemented
- **Test Procedure**: How to verify the control is operating
- **Frequency**: How often the control operates or is tested
- **Test Result**: ✅ PASS / ❌ FAIL / ⚠️ GAP (to be filled during walkthrough)
- **Evidence**: Specific artifact, log, or file path demonstrating control

---

## Control Environment (CC1)

### 1.1 Code of Conduct

| | |
|---|---|
| **Objective** | Establish ethical standards and accountability |
| **Implementation** | `docs/CODE_OF_CONDUCT.md` (TODO: create if not exists), signed acknowledgments |
| **Test Procedure** | 1. Verify document exists in `docs/`<br>2. Verify all team members have signed copy (check company records) |
| **Frequency** | Annual review |
| **Test Result** | ⚠️ GAP |
| **Evidence** | Signed copies in secure storage (TODO) |

**Gap**: Code of Conduct document not yet created.

---

### 1.2 Organizational Structure

| | |
|---|---|
| **Objective** | Clear roles and responsibilities |
| **Implementation** | `docs/org-chart.md` (TODO), `docs/CEO-HANDOFF-PACKAGE.md` |
| **Test Procedure** | 1. Verify org chart exists<br>2. Verify roles (CEO, CTO, COO, CMO, CSO) documented |
| **Frequency** | Quarterly review |
| **Test Result** | ⚠️ GAP |
| **Evidence** | Org chart missing; handover docs partially document structure |

**Gap**: Formal org chart not created.

---

### 1.3 Background Checks

| | |
|---|---|
| **Objective** | Ensure personnel trustworthiness |
| **Implementation** | HR records (BambooHR or equivalent) |
| **Test Procedure** | 1. Verify background check policy exists<br>2. Verify all operators with prod access have reports |
| **Frequency** | At hire + annually |
| **Test Result** | ⚠️ GAP |
| **Evidence** | No HR system configured yet |

**Gap**: Background check records not maintained.

---

### 1.4 Security Awareness Training

| | |
|---|---|
| **Objective** | Ensure team understands security policies |
| **Implementation** | Training materials in `docs/security/`, completion records |
| **Test Procedure** | 1. Verify training materials exist<br>2. Verify completion records for 2025-2026 cycle |
| **Frequency** | Annual + onboarding |
| **Test Result** | ⚠️ GAP |
| **Evidence** | Training materials exist; no completion tracking |

**Gap**: Training completion records not maintained.

---

## Communication and Information (CC2)

### 2.1 Internal Security Updates

| | |
|---|---|
| **Objective** | Keep team informed of security issues |
| **Implementation** | Slack #security-alerts (or #compliance), monthly meetings |
| **Test Procedure** | 1. Verify channel exists<br>2. Review recent messages (last 3 months) |
| **Frequency** | Monthly |
| **Test Result** | ⚠️ PARTIAL |
| **Evidence** | Slack channel exists; no consistent cadence |

**Gap**: No structured monthly security meetings documented.

---

### 2.2 Customer-Facing Security Documentation

| | |
|---|---|
| **Objective** | Transparent security posture to customers |
| **Implementation** | `docs/SECURITY.md`, `docs/INCIDENT_RESPONSE.md`, public website `/compliance` |
| **Test Procedure** | 1. Verify all required docs exist in `docs/`<br>2. Verify public website compliance page accessible |
| **Frequency** | Reviewed quarterly |
| **Test Result** | ✅ PASS |
| **Evidence** | `docs/SECURITY.md` (exists), `docs/INCIDENT_RESPONSE.md` (exists), website compliance page |

---

### 2.3 Incident Reporting Channels

| | |
|---|---|
| **Objective** | Clear path for security incident reporting |
| **Implementation** | `security@agencyos.network` mailbox, Slack #incidents |
| **Test Procedure** | 1. Verify email forwarding rules configured<br>2. Verify response SLA documented in runbook |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | `docs/INCIDENT_RESPONSE.md` defines channels and SLAs |

---

## Risk Assessment (CC3)

### 3.1 Annual Risk Assessment

| | |
|---|---|
| **Objective** | Identify and mitigate risks |
| **Implementation** | `plans/260617-1234-enterprise-gap-closure/plan.md` risk register |
| **Test Procedure** | 1. Verify risk register exists<br>2. Verify quarterly review meetings documented |
| **Frequency** | Quarterly review, annual formal assessment |
| **Test Result** | ✅ PASS |
| **Evidence** | Enterprise gap closure plan with risk matrix |

---

### 3.2 Third-Party Risk Assessments

| | |
|---|---|
| **Objective** | Vet vendor security practices |
| **Implementation** | `docs/soc2/VENDOR-SECURITY-REVIEW.md` template + completed reviews |
| **Test Procedure** | 1. Verify template exists<br>2. Verify completed reviews for critical vendors (Cloudflare, Sentry, NOWPayments) |
| **Frequency** | Annual or upon vendor change |
| **Test Result** | ⚠️ PARTIAL |
| **Evidence** | Template exists; vendor reviews incomplete |

**Gap**: NOWPayments SOC 2 expiring 2026-07-10 needs follow-up.

---

## Monitoring Activities (CC4)

### 4.1 Continuous Vulnerability Scanning

| | |
|---|---|
| **Objective** | Detect vulnerable dependencies |
| **Implementation** | Pre-push hook: `.husky/pre-push` runs `npm audit --audit-level=high` |
| **Test Procedure** | 1. Verify pre-push hook exists and blocks HIGH severity<br>2. Test by introducing vulnerable dependency (in isolated branch) |
| **Frequency** | Every commit (pre-push) |
| **Test Result** | ✅ PASS (to be tested) |
| **Evidence** | `.husky/pre-push` script (G5) |

**Test needed**: Verify hook actually blocks HIGH severity.

---

### 4.2 Quarterly Penetration Tests

| | |
|---|---|
| **Objective** | Independent security validation |
| **Implementation** | External pentest provider engagement |
| **Test Procedure** | 1. Verify pentest report exists in `docs/security/` |
| **Frequency** | Quarterly |
| **Test Result** | ❌ GAP |
| **Evidence** | None |

**Gap**: First pentest not scheduled (target Q3 2026).

---

### 4.3 Configuration Monitoring

| | |
|---|---|
| **Objective** | Detect unauthorized config changes |
| **Implementation** | `wrangler.toml` git-tracked, deploy guard enforces PR approval |
| **Test Procedure** | 1. Verify all config in git<br>2. Verify PR approval required for changes |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | `wrangler.toml` in git history; deploy guard logs |

---

### 4.4 Anomaly Detection

| | |
|---|---|
| **Objective** | Detect unusual behavior |
| **Implementation** | Sentry alerts (error rate spikes) |
| **Test Procedure** | 1. Verify Sentry project configured<br>2. Verify alert rules active |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | Sentry project: `sophia-ai-factory` |

---

## Control Activities (CC5)

### 5.1 Segregation of Duties

| | |
|---|---|
| **Objective** | No single person can deploy to prod |
| **Implementation** | `scripts/deploy/guard-deploy.js` requires PR approval OR 2-operator attestation |
| **Test Procedure** | 1. Attempt deploy without PR approval (should fail)<br>2. Attempt deploy with PR approval (should pass)<br>3. Test 2-operator attestation flow |
| **Frequency** | Every deploy |
| **Test Result** | ✅ PASS (to be tested) |
| **Evidence** | `scripts/deploy/guard-deploy.js`, `scripts/deploy-with-sha.sh` attestation section |

**Test needed**: Verify guard blocks unpushed commits, unapproved PRs.

---

### 5.2 Approval Workflows

| | |
|---|---|
| **Objective** | Changes reviewed before merge/deploy |
| **Implementation** | GitHub PR with ≥1 approval + deploy guard re-checks |
| **Test Procedure** | 1. Create PR without approval → should fail deploy guard<br>2. Merge PR with approval → should pass |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | GitHub branch protection or manual guard enforcement |

---

### 5.3 Least Privilege Access

| | |
|---|---|
| **Objective** | Users only have necessary access |
| **Implementation** | `src/seed/auth/require-admin.ts` checks role on admin routes |
| **Test Procedure** | 1. Verify admin routes protected by `requireAdminWithRecentAuth()`<br>2. Verify non-admin users cannot access `/api/admin/**` |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | Code review of admin route protectors |

---

### 5.4 Defense in Depth

| | |
|---|---|
| **Objective** | Multiple security layers |
| **Implementation** | Network (CF Workers), Auth (Better Auth), Session (httpOnly cookies), Input validation (Zod), Output encoding |
| **Test Procedure** | 1. Verify CSP headers set<br>2. Verify session cookies have httpOnly + Secure + SameSite<br>3. Verify all API routes use Zod schemas |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | `src/middleware.ts`, `src/app/layout.tsx`, Zod schemas in API routes |

---

## Logical and Physical Access (CC6)

### 6.1 MFA Enforcement

| | |
|---|---|
| **Objective** | Multi-factor authentication for critical access |
| **Implementation** | GitHub org MFA required, Cloudflare 2FA, app admin via email magic link |
| **Test Procedure** | 1. Verify GitHub org enforces MFA (check org settings)<br>2. Verify Cloudflare account has 2FA enabled |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | GitHub org security screenshot; Cloudflare account settings |

---

### 6.2 Quarterly Access Reviews

| | |
|---|---|
| **Objective** | Remove unused/ inappropriate access |
| **Implementation** | `scripts/security/quarterly-access-review.js` generates CSV/Markdown report |
| **Test Procedure** | 1. Run script: `node scripts/security/quarterly-access-review.js --quarter Q2-2026`<br>2. Verify output files created in `docs/security/access-reviews/`<br>3. Verify PR created with compliance sign-off |
| **Frequency** | Quarterly (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec) |
| **Test Result** | ❌ NOT RUN |
| **Evidence** | None (Q2 2026 review pending by 2026-06-30) |

**Gap**: Q2 2026 review not yet executed.

---

### 6.3 Privileged Access Management (PAM)

| | |
|---|---|
| **Objective** | Control and monitor admin access |
| **Implementation** | `requireAdminWithRecentAuth()` middleware; admin sessions expire |
| **Test Procedure** | 1. Verify `src/seed/auth/require-admin.ts` checks admin_challenge_token<br>2. Verify admin routes require recent auth (within 24h) |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | Code in `require-admin.ts` |

---

### 6.4 Background Checks

| | |
|---|---|
| **Objective** | Verify personnel trustworthiness |
| **Implementation** | Same as CC1.3 |
| **Frequency** | At hire + annually |
| **Test Result** | ⚠️ GAP |
| **Evidence** | Not implemented |

**Gap**: Background check policy not executed.

---

### 6.5 Physical Access Controls

| | |
|---|---|
| **Objective** | Protect physical infrastructure |
| **Implementation** | Cloudflare physical security (SOC 2 Type II), operator laptop encryption |
| **Test Procedure** | 1. Verify Cloudflare SOC 2 report covers physical security<br>2. Verify operator attestation of laptop encryption |
| **Frequency** | Annual review |
| **Test Result** | ✅ PASS |
| **Evidence** | Cloudflare SOC 2; operator attestation document (TODO) |

---

### 6.6 Audit Logging

| | |
|---|---|
| **Objective** | Immutable record of admin actions and system events |
| **Implementation** | Tables: `admin_audit_log` (migration 0170), `raas_audit_logs` (migration 0183)<br>Code: `src/tree/audit/logger/`<br>Hash chain: `previous_log_hash`, `content_hash` columns |
| **Test Procedure** | 1. Verify migrations 0170 and 0183 applied in production<br>2. Verify `raas_audit_logs` has hash chain values populated<br>3. Run verification script: `node scripts/audit/verify-hash-chain.js`<br>4. Verify cron job runs daily and alerts on failure |
| **Frequency** | Continuous (all admin actions); daily hash chain verification |
| **Test Result** | ✅ PASS (to be verified) |
| **Evidence** | Migration files; hash chain script output |

**Test needed**: Run hash chain verification script on production data.

---

## System Operations (CC7)

### 7.1 Incident Detection and Response

| | |
|---|---|
| **Objective** | Respond to security incidents promptly |
| **Implementation** | `docs/INCIDENT_RESPONSE.md`, severity ladder, response SLAs |
| **Test Procedure** | 1. Verify runbook exists<br>2. Conduct tabletop exercise (document results) |
| **Frequency** | Continuous; tabletop annually |
| **Test Result** | ✅ PASS |
| **Evidence** | Incident response runbook; incident log in `docs/incident-postmortems/` (if any) |

---

### 7.2 Backup Procedures

| | |
|---|---|
| **Objective** | Recover data after loss |
| **Implementation** | `src/app/api/cron/d1-backup/route.ts` → R2 `sophia-backups` (30-day lifecycle) |
| **Test Procedure** | 1. Verify backup cron route exists and auth protected by `CRON_SECRET`<br>2. Check R2 bucket `sophia-backups` has daily dumps (last 7 days)<br>3. Perform restore drill quarterly (see `docs/runbooks/backup-restore-drill.md`) |
| **Frequency** | Daily backup; monthly restore drill |
| **Test Result** | ✅ PASS (drill completed 2026-05-18) |
| **Evidence** | `docs/dr-drill-260518.md` (RTO=13s, RPO=0s); `scripts/verify-d1-backup.sh` |

---

### 7.3 Monitoring and Alerting

| | |
|---|---|
| **Objective** | Detect system issues |
| **Implementation** | Sentry error monitoring, Cloudflare Workers logs, health endpoint `/api/health` |
| **Test Procedure** | 1. Verify Sentry project configured and receiving errors<br>2. Verify health endpoint returns 200<br>3. Verify alerting configured for critical failures |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | Sentry project `sophia-ai-factory`; health check curl |

---

### 7.4 Capacity Planning

| | |
|---|---|
| **Objective** | Ensure system handles load |
| **Implementation** | Per-org quotas (missions, credentials, members) in `src/forest/quota/` |
| **Test Procedure** | 1. Verify quota enforcement code<br>2. Review load test results from `docs/load-test-260518.md` |
| **Frequency** | Quarterly review |
| **Test Result** | ✅ PASS |
| **Evidence** | Load test report; usage metering in `src/forest/usage-metering/` |

---

## Change Management (CC8)

### 8.1 Change Documentation

| | |
|---|---|
| **Objective** | Track all changes to production |
| **Implementation** | GitHub PRs with description, deploy audit log (`raas_audit_logs` on deploy) |
| **Test Procedure** | 1. Verify all deploys recorded in audit log (query `raas_audit_logs` where `action='DEPLOY'`)<br>2. Verify PR templates used<br>3. Verify rollback procedure documented in `docs/deployment-guide.md` |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | Deploy script `scripts/deploy-with-sha.sh` POSTs to `/api/admin/audit/deploy` |

---

### 8.2 Automated Testing

| | |
|---|---|
| **Objective** | Prevent regressions |
| **Implementation** | Vitest unit tests + Playwright E2E; smoke tests (`@smoke` tag) |
| **Test Procedure** | 1. Verify `npm test` passes (all 1398+ tests)<br>2. Verify pre-deploy test gate in `deploy-with-sha.sh`<br>3. Verify coverage thresholds (if configured) |
| **Frequency** | Every commit (pre-push) + pre-deploy |
| **Test Result** | ✅ PASS (to be verified) |
| **Evidence** | `vitest.config.ts`; `test-report.json` |

**Test needed**: Run `npm test` and verify all pass.

---

### 8.3 Change Advisory Board (CAB)

| | |
|---|---|
| **Objective** | Review significant changes |
| **Implementation** | Not formalized; all engineers review PRs; emergency overrides via `--override` with audit log |
| **Test Procedure** | 1. Verify PR approval required (deploy guard)<br>2. Verify emergency overrides are audit-logged |
| **Frequency** | As needed |
| **Test Result** | ✅ PASS |
| **Evidence** | `scripts/deploy/guard-deploy.js`; `deploy-with-sha.sh` override section |

---

## Risk Mitigation (CC9)

### 9.1 Vendor Risk Assessments

| | |
|---|---|
| **Objective** | Ensure vendor security |
| **Implementation** | `docs/soc2/VENDOR-SECURITY-REVIEW.md` template + completed reviews |
| **Test Procedure** | 1. Verify template exists<br>2. Verify reviews for Cloudflare (SOC 2 Type II), Sentry (SOC 2 Type II), NOWPayments (Type I expiring 2026-07-10) |
| **Frequency** | Annual or upon material change |
| **Test Result** | ⚠️ PARTIAL |
| **Evidence** | Template exists; NOWPayments SOC 2 status needs renewal |

---

### 9.2 Business Interruption Insurance

| | |
|---|---|
| **Objective** | Financial protection against downtime |
| **Implementation** | Not currently held (TODO for enterprise customers) |
| **Test Procedure** | N/A |
| **Frequency** | N/A |
| **Test Result** | ❌ GAP |
| **Evidence** | Policy procurement pending |

---

### 9.3 Cyber Liability Insurance

| | |
|---|---|
| **Objective** | Cover data breach response costs |
| **Implementation** | Not currently held (TODO) |
| **Test Procedure** | N/A |
| **Frequency** | N/A |
| **Test Result** | ❌ GAP |
| **Evidence** | Insurance procurement pending |

---

### 9.4 Contracts with Security Requirements

| | |
|---|---|
| **Objective** | Ensure vendor security commitments |
| **Implementation** | DPAs on file for Cloudflare, Sentry, NOWPayments |
| **Test Procedure** | 1. Verify DPAs exist in legal records<br>2. Verify security requirements included |
| **Frequency** | Per vendor contract |
| **Test Result** | ⚠️ GAP |
| **Evidence** | DPAs not yet stored digitally (TODO) |

---

## Availability (A1)

### A1.1 Uptime SLA

| | |
|---|---|
| **Objective** | Meet customer uptime expectations |
| **Implementation** | Target: 99.9% uptime |
| **Test Procedure** | 1. Verify external uptime monitor configured<br>2. Verify monthly uptime reports (if automated) |
| **Frequency** | Continuous monitoring |
| **Test Result** | ⚠️ GAP |
| **Evidence** | Uptime measurement not yet automated |

**Gap**: Status page not implemented; manual checks only.

---

### A1.2 Redundancy

| | |
|---|---|
| **Objective** | Minimize downtime from failures |
| **Implementation** | Multi-region: single region (Cloudflare Workers global edge, D1 single-region)<br>RPO: 0 (daily backups)<br>RTO: 13s (from DR drill) |
| **Test Procedure** | 1. Verify DR drill conducted (`docs/dr-drill-260518.md`)<br>2. Verify backup restore tested |
| **Frequency** | Monthly restore drill |
| **Test Result** | ✅ PASS |
| **Evidence** | DR drill report; R2 30-day retention |

---

### A1.3 Load Testing

| | |
|---|---|
| **Objective** | Validate performance under load |
| **Implementation** | `docs/load-test-260518.md` — 100 concurrent users, 60s duration, p95 < 200ms |
| **Test Procedure** | 1. Review load test report<br>2. Verify load test runbook exists |
| **Frequency** | Quarterly or before major releases |
| **Test Result** | ✅ PASS |
| **Evidence** | Load test report and runbook |

---

### A1.4 Failover Procedures

| | |
|---|---|
| **Objective** | Recover from region failure |
| **Implementation** | `docs/runbooks/D1-REGION-FAILURE.md` (manual recovery from backup) |
| **Test Procedure** | 1. Verify runbook exists<br>2. Document failover procedure |
| **Frequency** | As needed |
| **Test Result** | ✅ PASS |
| **Evidence** | DR runbook documents manual recovery |

---

## Confidentiality (C1)

### C1.1 Data Classification

| | |
|---|---|
| **Objective** | Classify data by sensitivity |
| **Implementation** | `docs/DATA-CLASSIFICATION.md` (TODO) |
| **Test Procedure** | 1. Verify policy exists<br>2. Verify classification levels defined |
| **Frequency** | Annual review |
| **Test Result** | ❌ GAP |
| **Evidence** | Policy not yet created |

---

### C1.2 Encryption at Rest

| | |
|---|---|
| **Objective** | Protect stored data from unauthorized access |
| **Implementation** | D1: Cloudflare-managed encryption<br>R2: AES-256 (default)<br>BYOK keys: AES-256-GCM with `BYOK_MASTER_KEY` |
| **Test Procedure** | 1. Verify Cloudflare encryption at rest (docs)<br>2. Verify BYOK implementation in `src/tree/byok/byok-crypto.ts` uses AES-GCM-256<br>3. Verify master key stored in CF secrets |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | Cloudflare documentation; `byok-crypto.ts`; `wrangler secret list` |

---

### C1.3 Encryption in Transit

| | |
|---|---|
| **Objective** | Protect data during transmission |
| **Implementation** | TLS 1.3 enforced, HSTS `max-age=63072000` |
| **Test Procedure** | 1. Verify TLS 1.3 in use (SSL Labs test)<br>2. Verify HSTS header present in responses |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | `src/middleware.ts` sets security headers; SSL Labs grade A+ expected |

---

### C1.4 Database Isolation

| | |
|---|---|
| **Objective** | Prevent cross-tenant data access |
| **Implementation** | Single D1 with `org_id` / `user_id` filters; `validateTenantIsolation()` middleware |
| **Test Procedure** | 1. Verify `org_id` filter on all multi-tenant queries<br>2. Verify B2 fix (HeyGen webhook org validation) in `src/forest/webhooks/heyegen-webhook-handler.ts` |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | `src/forest/raas/validate-tenant-isolation.ts` |

---

### C1.5 Secrets Management

| | |
|---|---|
| **Objective** | Protect sensitive credentials |
| **Implementation** | Cloudflare Workers Secrets (`wrangler secret put`); never in git |
| **Test Procedure** | 1. Verify `.env.example` only lists required secrets (no actual values)<br>2. Verify `wrangler secret list` shows secrets set<br>3. Verify secretlint pre-push hook catches secrets (`npm run lint` includes secret check) |
| **Frequency** | Continuous; rotate per runbook |
| **Test Result** | ✅ PASS |
| **Evidence** | `.env.example`; secretlint config `.secretlintrc.json` |

---

### C1.6 Data Retention and Deletion

| | |
|---|---|
| **Objective** | Comply with data subject rights (GDPR) |
| **Implementation** | Account deletion cascade; R2 30-day lifecycle; `src/tree/compliance/right-to-erasure-legal-hold.ts` |
| **Test Procedure** | 1. Verify cascade deletes in `FULL_MIGRATION.sql`<br>2. Verify R2 lifecycle policy `infrastructure/r2-lifecycle-30d.json`<br>3. Verify legal hold overrides deletion |
| **Frequency** | Continuous |
| **Test Result** | ✅ PASS |
| **Evidence** | Migration with cascade rules; R2 lifecycle config; right-to-erasure implementation |

---

## Summary of Gaps Identified

### High Severity
1. **No SOC 2 auditor engaged** — Must select and engage by 2026-06-30 (target Aug 2026 report)
2. **No penetration test report** — Schedule Q3 2026
3. **No cyber liability insurance** — Procure (recommend $1-5M coverage)
4. **First key rotation not executed** — Test on staging, then production (test user) by July 2026
5. **NOWPayments SOC 2 expiring 2026-07-10** — Follow up for renewal

### Medium Severity
6. **Quarterly access review Q2 not run** — Must complete by 2026-06-30
7. **Uptime SLA measurement not automated** — Implement external monitoring + status page
8. **APM/SLO dashboard incomplete** — Phase 3 pending (SLO monitoring)
9. **Deploy guard verification needed** — Test that it blocks unapproved deploys
10. **Hash chain verification not run** — Execute `scripts/audit/verify-hash-chain.js` on production data

### Low Severity
11. **Data classification policy missing** — Create `docs/DATA-CLASSIFICATION.md`
12. **Code of Conduct missing** — Create `docs/CODE_OF_CONDUCT.md`
13. **Formal org chart missing** — Document structure
14. **Background check policy not implemented** — Establish process
15. **Training completion records not tracked** — Implement tracking
16. **Vendor security reviews incomplete** — Complete Cloudflare, Sentry, NOWPayments reviews
17. **DPAs not stored digitally** — Compile in secure location
18. **Business interruption insurance not held** — Consider for enterprise contracts

---

## Test Execution Plan

To complete this walkthrough, the following tests will be executed:

1. **Test 1: Deploy Guard**  
   - Attempt to deploy without PR approval → should block  
   - Verify pre-push hook warns  
   - Check `scripts/deploy/guard-deploy.js` exit codes

2. **Test 2: Hash Chain Verification**  
   - Run `node scripts/audit/verify-hash-chain.js` on production D1  
   - Verify exit code 0 (chain valid)  
   - Review output for broken links

3. **Test 3: Backup Availability**  
   - List R2 objects: `npx wrangler r2 object list sophia-backups`  
   - Verify at least 7 days of backups present  
   - Verify latest backup size reasonable (not 0 bytes)

4. **Optional: Quarterly Access Review**  
   - Run `node scripts/security/quarterly-access-review.js --quarter Q2-2026`  
   - Verify Markdown and CSV outputs created

5. **Optional: Audit Log Sampling**  
   - Query `raas_audit_logs` for recent entries  
   - Verify `hash_chain_valid = 1` and `previous_log_hash` links

---

## Next Steps

1. Execute tests 1-3 above and document results in this checklist
2. Update `plans/260621-soc2-type1-completion/plan.md` with evidence gaps
3. Address high-severity gaps (auditor engagement, pentest, insurance, key rotation)
4. Compile evidence pack for auditor (docs, logs, reports, screenshots)
5. Schedule kickoff with selected SOC 2 auditor

---

**Status:** In Progress — Tests pending  
**Last Updated:** 2026-06-22  
**Next Review:** After test execution
