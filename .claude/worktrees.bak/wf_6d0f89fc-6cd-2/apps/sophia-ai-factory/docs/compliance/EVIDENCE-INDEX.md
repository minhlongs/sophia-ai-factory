# Compliance Evidence Index

**Effective:** 2026-06-22  
**Purpose:** Central index of all SOC 2 Type I audit evidence  
**Auditor Reference:** This document maps evidence files to SOC 2 criteria  

---

## Table of Contents

1. [Vendor Management (CC9.1)](#vendor-management-cc91)
2. [Logical Access (CC6.1, CC7.1-7.4)](#logical-access)
3. [Change Management (CC8.1)](#change-management)
4. [Incident Response (A1.5)](#incident-response)
5. [Risk Management (CC3.2, CC3.4)](#risk-management)
6. [Encryption & Cryptography (CC6.7, CC6.8)](#encryption--cryptography)
7. [Backup & Recovery (A1.6)](#backup--recovery)
8. [Business Continuity (A1.7)](#business-continuity)

---

## Vendor Management (CC9.1)

**Criteria:** Vendor selection, monitoring, and termination processes.

| Evidence Item | Location | Status | Description |
|---------------|----------|--------|-------------|
| Vendor SOC 2 Reports | `docs/compliance/vendor-soc2-reports/` | ✅ Complete | Individual reports for all critical vendors |
| Vendor SOC 2 Summary Matrix | `docs/compliance/VENDOR-SOC2.md` | ✅ Complete | Table of all vendors with SOC 2 status |
| Vendor Management Policy | `docs/soc2/VENDOR-SECURITY-REVIEW.md` | ⚠️ Needs update | Policy to be updated with collected reports |
| DPAs (Data Processing Agreements) | Various vendor portals | ✅ Partial | DPA signed with Cloudflare, Sentry, Stripe, Resend; need to archive copies |
| Subprocessor List | Cloudflare: https://www.cloudflare.com/trust-hub/subprocessors/ | ✅ Reviewed | Cloudflare subprocessors reviewed 2025-06-22 |
| NOWPayments PCI DSS | `docs/compliance/vendor-soc2-reports/` (if obtained) | ⚠️ Gap | PCI DSS Level 1 cert requested |

**Action Items:**
- [ ] Archive copies of all signed DPAs in `docs/compliance/contracts/`
- [ ] Request NOWPayments PCI DSS certificate
- [ ] Update `VENDOR-SECURITY-REVIEW.md` with current vendor status

---

## Logical Access

**Criteria:** Access controls, authentication, and authorization.

| Evidence Item | Location | Status | Description |
|---------------|----------|--------|-------------|
| Access Control Policy | `docs/soc2/ACCESS-CONTROL-POLICY.md` | ⚠️ TODO | Need to document current RBAC implementation |
| User Access Reviews | `scripts/audit/quarterly-access-review.js` | ✅ Implemented | Script to generate quarterly access review PRs |
| First Access Review PR | GitHub PR # (first run) | ⏳ Pending | First quarterly review to be generated July 2025 |
| Authentication Implementation | `src/seed/auth/better-auth-session.ts` | ✅ Implemented | Session-based auth with role claims |
| Admin Authentication | `src/land/operations/sop-billing-payouts.ts` | ✅ Protected | Admin-only API routes with role checks |
| SSH/Deploy Access | `.husky/pre-push` + deploy guard | ✅ Implemented | Pre-push guard + PR approval requirement |

**Action Items:**
- [ ] Create ACCESS-CONTROL-POLICY.md documenting RBAC
- [ ] Run first quarterly access review (July 2025)
- [ ] Archive access review PR as evidence

---

## Change Management (CC8.1)

**Criteria:** Tracking and approval of system changes.

| Evidence Item | Location | Status | Description |
|---------------|----------|--------|-------------|
| Deploy Guard Implementation | `scripts/deploy/guard-deploy.js` | ✅ Implemented | Blocks deploys without PR approval |
| Pre-push Hook | `.husky/pre-push` | ✅ Implemented | Warns on unpushed commits |
| Deploy Script | `deploy-with-sha.sh` | ✅ Implemented | SHA-verified deploy with guard check |
| GitHub PR Workflow | GitHub Actions (if re-enabled) | ⚠️ Disabled | CI disabled by design; manual deploy verification |
| Migration System | `migrations/` + `scripts/apply-migrations.sh` | ✅ Implemented | Versioned DB migrations with apply script |
| Deployment Runbook | `docs/deployment-guide.md` | ✅ Exists | Should verify it documents SHA verification |

**Action Items:**
- [ ] Verify deployment-guide.md includes SHA verification steps
- [ ] Archive sample deploy logs showing guard blocking unapproved deploys
- [ ] Consider re-enabling CI for typecheck/lint (currently run manually pre-commit)

---

## Incident Response (A1.5)

**Criteria:** Incident detection and response procedures.

| Evidence Item | Location | Status | Description |
|---------------|----------|--------|-------------|
| Incident Response Runbook | `docs/INCIDENT_RESPONSE.md` | ✅ Complete | Detailed incident classification and response procedures |
| Escalation Contacts | `docs/INCIDENT_RESPONSE.md` (Section 3) | ✅ Documented | P0-P3 escalation paths with SLAs |
| Post-Incident Template | `docs/INCIDENT_RESPONSE.md` (Appendix) | ✅ Exists | Post-mortem template with root cause analysis |
| Monitoring Setup | Cloudflare Analytics + Sentry | ✅ Implemented | Error tracking and performance monitoring |
| Alerting | Inngest failures → Telegram alerts | ✅ Implemented | Critical job failures alert to operations channel |

**Action Items:**
- [ ] Conduct tabletop incident response drill (document results)
- [ ] Archive sample incident log (if any occurred)
- [ ] Verify all P0 escalation contacts are current

---

## Risk Management (CC3.2, CC3.4)

**Criteria:** Risk assessment and mitigation.

| Evidence Item | Location | Status | Description |
|---------------|----------|--------|-------------|
| SOC 2 Completion Plan | `plans/260621-soc2-type1-completion/plan.md` | ✅ Complete | Detailed plan with task mapping and timeline |
| Risk Assessment | `plans/260621-soc2-type1-completion/plan.md` (Section "Risk Assessment") | ✅ Documented | Risk matrix with likelihood/impact/mitigation |
| Gap Status Tracking | `docs/compliance/VENDOR-SOC2.md` (Gap Status) | ✅ Updated | Vendor gap tracking with target resolution dates |
| Security Controls Documentation | `docs/soc2/` (to be created) | ⚠️ TODO | Need to map implemented controls to SOC 2 criteria |

**Action Items:**
- [ ] Create security controls matrix mapping code → SOC 2 criteria
- [ ] Update risk assessment quarterly

---

## Encryption & Cryptography (CC6.7, CC6.8)

**Criteria:** Encryption of data in transit and at rest.

| Evidence Item | Location | Status | Description |
|---------------|----------|--------|-------------|
| BYOK Crypto Implementation | `src/tree/byok/byok-crypto.ts` | ✅ Implemented | Versioned encryption with customer-managed keys |
| Encryption at Rest | Cloudflare D1 + R2 | ✅ Enabled | D1 and R2 provide server-side encryption |
| TLS Configuration | `wrangler.toml` (min_version = 1.3) | ✅ Configured | Enforces TLS 1.3 for all connections |
| Key Rotation Runbook | `docs/runbooks/KEY-ROTATION.md` | ✅ Complete | Detailed key rotation procedures |
| Key Rotation API | `src/app/api/admin/keys/rotate/route.ts` | ✅ Implemented | Admin-triggered rotation endpoint |
| Inngest Re-encrypt Job | `src/forest/inngest/functions/key-rotation-reencrypt.ts` | ✅ Implemented | Batch re-encryption of all credentials |
| Migration 0184 | `migrations/0184_add_key_version_columns.sql` | ✅ Applied | Key version tracking in database |

**Action Items:**
- [ ] Archive sample encrypted credential (redacted)
- [ ] Document TLS configuration settings
- [ ] Include key rotation test results from staging

---

## Backup & Recovery (A1.6)

**Criteria:** Backup creation, testing, and restoration.

| Evidence Item | Location | Status | Description |
|---------------|----------|--------|-------------|
| D1 Backup Job | `src/app/api/cron/d1-backup/route.ts` (if exists) or `docs/runbooks/BACKUP-RESTORE.md` | ⚠️ Verify | Verify backup job exists and is documented |
| Backup Storage | Cloudflare R2 (`BACKUPS_BUCKET`) | ✅ Configured | R2 bucket with 30-day lifecycle policy |
| Backup Runbook | `docs/runbooks/BACKUP-RESTORE.md` | ⚠️ TODO | Need to create if not exists |
| Restore Test Logs | Manual test results (if conducted) | ❌ Missing | No quarterly restore tests conducted yet |
| R2 Lifecycle Policy | `wrangler.toml` R2 bindings + lifecycle rules | ✅ Configured | 30-day auto-deletion of old backups |

**Action Items:**
- [ ] Verify D1 backup cron endpoint exists and works
- [ ] Create BACKUP-RESTORE.md runbook with step-by-step restore procedures
- [ ] Conduct quarterly restore test (next: Q3 2025) and archive results
- [ ] Document R2 lifecycle policy configuration

---

## Business Continuity (A1.7)

**Criteria:** Disaster recovery and business continuity planning.

| Evidence Item | Location | Status | Description |
|---------------|----------|--------|-------------|
| Disaster Recovery Plan | `docs/disaster-recovery.md` | ✅ Exists | Should verify content matches current architecture |
| RTO / RPO Targets | `docs/disaster-recovery.md` (Section 2) | ⚠️ Verify | Expected RTO <4h, RPO <1h (per Cloudflare) |
| Failover Procedures | `docs/deployment-guide.md` or DR plan | ⚠️ Verify | Cloudflare region failover is automatic; document manual overrides if any |
| Incident Response Integration | `docs/INCIDENT_RESPONSE.md` (P0 incidents) | ✅ Integrated | DR incidents classified as P0 |
| Deploy Rollback | `sophia-deploy-verify.md` (Rollback section) | ✅ Documented | `wrangler rollback` procedure documented |

**Action Items:**
- [ ] Verify disaster-recovery.md aligns with Cloudflare multi-region capabilities
- [ ] Document DR test results (tabletop or actual failover)
- [ ] Archive RTO/RPO targets as evidence

---

## Additional Evidence (Not Mapped to Specific Criteria)

| Evidence Item | Location | Description |
|---------------|----------|-------------|
| SOC 2 Completion Plan | `plans/260621-soc2-type1-completion/plan.md` | Overall project plan with tasks #41-66 |
| Implementation Status | `plans/260621-soc2-type1-completion/plan.md` (Section "Current Implementation Status") | Detailed technical implementation summary |
| Audit Infrastructure Code | `src/tree/audit/` | Audit logger with hash chain implementation |
| Hash Chain Verification | `scripts/audit/verify-hash-chain.js` (if exists) | Chain integrity checker (verify exists) |
| Quarterly Access Review Script | `scripts/audit/quarterly-access-review.js` | Automated access review generator |

---

## Evidence Collection Status Summary

| Category | Complete | In Progress | Missing | Notes |
|----------|----------|-------------|---------|-------|
| Vendor Management | 5/6 (83%) | 1/6 (Resend gap) | 0 | All vendor reports collected except Resend SOC 2 |
| Logical Access | 60% | 40% | 1 doc | Need ACCESS-CONTROL-POLICY.md |
| Change Management | 80% | 20% | 0 | Deploy guard working; verify docs |
| Incident Response | 100% | 0% | 0 | Runbook complete; need drill evidence |
| Risk Management | 75% | 25% | 1 doc | Controls matrix needed |
| Encryption | 90% | 10% | 0 | All core implemented; need test evidence |
| Backup & Recovery | 40% | 30% | 30% | Need runbook + restore tests |
| Business Continuity | 60% | 40% | 0 | Need DR test evidence |

**Overall Evidence Completion:** ~75% (Core vendor evidence collected; documentation gaps remain)

---

## Next Steps for Evidence Pack Compilation

1. **High Priority (Week 1):**
   - [ ] Archive all vendor SOC 2 reports (download PDFs from vendor portals)
   - [ ] Archive DPAs (collect from vendor portals or email)
   - [ ] Create ACCESS-CONTROL-POLICY.md
   - [ ] Create BACKUP-RESTORE.md runbook

2. **Medium Priority (Week 2-3):**
   - [ ] Run quarterly access review (July 2025)
   - [ ] Conduct backup restore test (staging)
   - [ ] Document TLS configuration and encryption settings
   - [ ] Create security controls matrix (code → SOC 2 criteria mapping)

3. **Lower Priority (Week 4+):**
   - [ ] Conduct tabletop DR drill
   - [ ] Archive sample deploy logs showing guard enforcement
   - [ ] Verify hash chain verification script exists and works

---

## Document Version History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-06-22 | 1.0 | Initial evidence index; vendor reports collected | CTO |
| | | | |

---

**Auditor Note:** This index serves as the master inventory of evidence. Each item should be cross-referenced to the corresponding SOC 2 criteria and included in the final evidence pack ZIP archive submitted to the auditor.

**Evidence Pack Location (when compiled):** `docs/compliance/evidence-pack-2026-type1/`
