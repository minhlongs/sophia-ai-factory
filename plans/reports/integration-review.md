# Cross-Cutting Integration Review — CTO & COO Outputs

**Date:** 2026-06-20  
**Reviewer:** Claude (Code Reviewer)  
**Scope:** Tasks #44+88 (Deploy Guard), OTEL instrumentation, BYOK rotation runbook alignment  
**Status:** BLOCKED — Critical integration gaps identified  

---

## Executive Summary

Review of CTO and COO deliverables reveals **3 critical integration gaps** across deploy guard audit logging, OTEL SOC 2 monitoring, and BYOK rotation incident response alignment. While individual components are implemented, they do not form a coherent compliance and incident response system.

**Key finding:** The SOC 2 Type I report claims "Technical Implementation Complete" but cross-cutting dependencies are unverified. The system would fail an audit for inconsistent audit trail coverage and missing SOC 2 control evidence from observability.

---

## 1. Deploy Guard + Audit Logger Integration (Task 44+88)

### Status: ✅ Implemented but ⚠️ Inconsistent Coverage

**What exists:**
- Deploy Guard admin UI (`deploy-guard-admin-ui-260621.md`) uses `raas_audit_logs` and `admin_audit_log`
- Hash chain verification (`scripts/audit/verify-hash-chain.js`) with daily cron
- Immutable audit log tables with triggers (migrations 0170, 0183)
- `logAuditEvent()` utility for generic audit events

**Critical gap: ADM-09 (Admin Operations Gap Report)**

The admin-ops gap audit (2026-05-13) identifies:

> "Audit trail: Postmortem and audit logs exist technically. Business actions like support provider choice, partner outreach, launch execution lack audit trail template."

**Missing integration:**
- Deploy Guard logs its own actions (attest, override) but **other admin operations** (vendor management, support provider selection, SLA tier changes) have no standardized audit pattern
- The `logAuditEvent()` utility exists but is only used in:
  - Key rotation (`key-rotation-reencrypt.ts`, `/api/admin/keys/rotate`)
  - Audit query logger write operations
  - Circuit breaker events
  
  **Not used for:** Support workflow changes, payment provider switches, vendor onboarding/offboarding

**Evidence from code scan:**
```typescript
// Files using logAuditEvent:
- forest/inngest/functions/key-rotation-reencrypt.ts ✅
- app/api/admin/keys/rotate/route.ts ✅
- app/api/usage/reconciliation/sync/route.ts ✅
- license/sync/route.ts ✅
- usage-metering/realtime-tracker-circuit-breaker.ts ✅

// Expected but missing:
// - Support provider changes
// - Payment processor configuration changes
// - Vendor credential updates
// - SLA tier modifications
```

**Risk:** SOC 2 CC7.2 requires audit trail for "all significant events." The current implementation is fragmented, creating audit gaps for operational decisions.

---

## 2. OTEL Instrumentation + SOC 2 Monitoring Requirements

### Status: ⚠️ Infrastructure Present, Control Mapping Missing

**What exists:**
- OpenTelemetry SDK (`src/seed/telemetry/opentelemetry-setup.ts`) with Honeycomb exporter
- API route instrumentation (`instrument-api.ts`) with spans and metrics
- Fetch instrumentation for outgoing requests
- Inngest instrumentation (`instrument-inngest.ts`)

**Critical gap: No SOC 2 control-specific instrumentation**

The SOC 2 Type I completion report (2026-06-21) lists "APM implementation (OpenTelemetry) to close observability gaps for 100 score" as a **recommendation**, not a completed deliverable.

**Missing integration:**

1. **No SOC 2 control attributes** on spans/metrics:
   - Separation of duties violations (e.g., deploy guard bypasses)
   - Key rotation lifecycle events
   - Audit log integrity failures
   - Access review anomalies
   
   Current instrumentation only tracks generic HTTP metrics (duration, status). SOC 2 requires evidence that controls are operating.

2. **No alerting configuration** for compliance events:
   - `runbooks/APM-ALERTS.md` exists but is placeholder content
   - No Honeycomb alert rules defined for:
     - `deploy_guard.override` count > 0 in 24h
     - `key_rotation.failure` events
     - `audit_log.hash_chain_invalid` flag
     - `admin_audit_log.delete_attempt` (should be 0)

3. **Missing SLOs/SLIs for compliance controls**:
   - Deploy guard quorum achievement rate
   - Key rotation completion time (within 7-day window?)
   - Hash chain verification success rate (should be 100%)
   - Quarterly access review completion

**Evidence from code:**
```typescript
// instrument-api.ts creates generic spans:
const spanName = `api.${options.method.toLowerCase()}.${options.route.replace(/\//g, '.')}`;
// Attributes: http.method, http.route, component
// MISSING: compliance_control_id, soc2_cc6_1, soc2_cc7_2, etc.
```

**Risk:** Without control-mapped telemetry, auditors cannot verify SOC 2 controls are effective. The platform has "silver metric" (availability) but no "golden signal" for compliance.

---

## 3. BYOK Rotation Runbook + Incident Response Alignment

### Status: ❌ Misaligned — Contradictory Procedures

**What exists:**
- BYOK rotation runbook (`docs/runbooks/KEY-ROTATION.md`) — detailed, versioned
- Incident response (`docs/INCIDENT_RESPONSE.md`) — includes "BYOK Key Compromise" section
- SOC 2 report lists key rotation infrastructure as complete

**Critical misalignment findings:**

| Aspect | Rotation Runbook | Incident Response | Gap |
|--------|------------------|-------------------|-----|
| **Rotation trigger** | Admin endpoint `/api/admin/keys/rotate` (scheduled) | Manual master key rotation via CF dashboard | Incident response doesn't reference automated endpoint |
| **Re-encryption** | Inngest job `key-rotation-reencrypt` (batched, monitored) | "Procedure not yet documented (Phase 4)" | Contradiction: one says implemented, other says TBD |
| **Dual-decrypt window** | 7 days enforced in `byok-crypto.ts` | Mentions "re-encrypt all stored keys" without window | Incident response ignores window |
| **Customer notification** | Not mentioned in runbook | "Bulk customer notification — email system for 're-enter keys' — Phase 4 candidate" | Runbook silent on comms, incident says not built |
| **Rollback** | SQL to toggle `key_versions.is_active` + re-run read verification | "If new version not safe, immediately disable" (no SQL provided) | Incident lacks precise steps |
| **Verification** | Read-path test + log verification + rollback verification | Partial (suggests checking logs) | Incident missing structured checklist |

**Direct contradiction:**

From SOC 2 report (line 333): "BYOK master key rotation procedure not yet implemented (Phase 4)"

From rotation runbook (exists and is detailed): Says effective 2026-06-17, with steps to trigger, monitor, verify, rollback.

**Which is correct?** Code evidence shows:
- `/api/admin/keys/rotate` route exists and uses `logAuditEvent`
- `key-rotation-reencrypt.ts` Inngest function exists
- `byok-crypto.ts` has dual-decrypt window (7 days)
- Migration 0184 (`key_versions`) exists

**Conclusion:** The SOC 2 report is outdated. The rotation **is** implemented. However, the incident response runbook is not updated to reflect this, causing operator confusion during actual incidents.

**Risk during incident:** Operator follows incident response, sees "procedure not yet documented", panics or does manual CF secret rotation without Inngest job, causing mass customer outage.

---

## Cross-Cutting Dependencies Missed

### D1: Deploy Guard → Audit Logger → OTEL

**Expected flow:** Deploy guard actions → `admin_audit_log` → OTEL span attributes for compliance dashboard.

**Actual:** 
- Deploy guard logs to `admin_audit_log` ✅
- `admin_audit_log` has hash chain ✅
- **No OTel span attributes exported** for audit log writes
- **No Honeycomb dataset** includes `soc2_control_id` or `audit_event_type`

**Impact:** Cannot correlate deployment approvals with monitoring dashboards. Auditor asks "show me separation-of-duties violations over time" — answer requires manual SQL queries, not real-time dashboard.

### D2: BYOK Rotation → Incident Response → OTEL Alerts

**Expected flow:** Rotation job emits spans → Honeycomb alerts on failure/partial success → Incident response playbook triggered automatically.

**Actual:**
- Inngest function `key-rotation-reencrypt` uses `logAuditEvent()` but does **not create OTel spans**
- Inngest instrumentation exists but may not capture custom function events
- No alert rule for `key_rotation.reencrypt_complete` with `total < expected` (partial failure)
- Incident response assumes operator manually detects rotation issues

**Impact:** Failed rotation could go undetected for days. If Inngest job retries 3 times and stalls, no PagerDuty/Telegram alert.

### D3: OTEL → SOC 2 Evidence Collection

**Expected:** OTEL metrics feed into compliance evidence pack (automatic).

**Actual:** 
- OTEL exports to Honeycomb but no queries saved
- No periodic report generation (e.g., "Deploy guard quorum: 100% last 30 days")
- SOC 2 evidence pack is static files (`docs/soc2/`) without live metric links

**Impact:** Auditor requires 30-day evidence observation period. Current process requires manual Honeycomb query export → labor-intensive and prone to gaps.

---

## Conflict Matrix

| Conflict | Components Involved | Severity | Resolution Required |
|----------|---------------------|----------|---------------------|
| C1 | SOC 2 report says "rotation not implemented" vs actual code | P0 (Misleading) | Update SOC 2 report to reflect implementation; align incident response |
| C2 | Incident response BYOK procedure missing automated steps | P0 (Operational risk) | Update incident response with `/api/admin/keys/rotate` + Inngest job monitoring |
| C3 | Customer notification "Phase 4 candidate" vs rotation runbook silent | P1 (Compliance gap) | Define notification procedure; add to rotation runbook |
| C4 | Deploy guard uses audit log but other admin actions don't | P1 (Audit gap) | Create `docs/admin-ops/audit-trail-template.md` with action categories |
| C5 | OTEL present but no SOC 2 control mapping | P1 (Missing evidence) | Add `compliance_control_id` span attribute; create Honeycomb alerts |
| C6 | Dual-decrypt window (7d) not reflected in incident response rollback steps | P2 (Technical gap) | Clarify that rollback within window is safe; update procedure |

---

## Recommendations

### Immediate (Blocking)

1. **Resolve BYOK rotation contradiction (C1, C2)**  
   - Update `docs/INCIDENT_RESPONSE.md` BYOK section to reference `/api/admin/keys/rotate` endpoint  
   - Remove "procedure not yet documented" language  
   - Add Inngest dashboard monitoring steps  

2. **Standardize admin action audit logging (C4)**  
   - Create `docs/admin-ops/audit-trail-template.md` enumerating all admin actions that must be logged  
   - Add `logAuditEvent()` calls to:
     - Support provider changes
     - Payment processor configuration updates
     - Vendor credential rotations  
     - SLA tier modifications  

3. **Fix OTEL SOC 2 control mapping (C5)**  
   - Modify `instrument-api.ts` to add `compliance_control_id` attribute based on route  
   - Create mapping file: `src/seed/telemetry/soc2-control-mapping.json`  
   - Example:  
     ```json
     { "route": "/api/admin/deploy-guard/attest", "control": "CC6.1", "title": "Separation of Duties" }
     ```  
   - Configure Honeycomb alerts for control failures (0 alert = compliance health)

### Short-term (1-2 weeks)

4. **Add audit log instrumentation to OTEL**  
   - Create span around `insertAuditLog()` calls  
   - Attribute: `audit.action`, `audit.user_id`, `audit.hash_chain_valid`  
   - Metric: `audit.logs.written.per_minute`, `audit.hash_chain.errors`  

5. **Create compliance evidence dashboard**  
   - Honeycomb saved query: "Deploy Guard Approval Quorum (30 days)"  
   - Link from `docs/soc2/INTERNAL-CONTROLS-WALKTHROUGH.md` to live dashboard  
   - Screenshot for static evidence pack (with date)  

6. **Define customer notification procedure for key rotation**  
   - Email template: "Your encrypted credentials have been re-encrypted — please verify"  
   - Send after `key_rotation.reencrypt_complete` event  
   - Track notification status in `user_notification_log` table  

### Medium-term (1 month)

7. **Add SOC 2 metrics to daily health checks**  
   - Extend `/api/health` with `compliance_status` field  
   - Include: hash_chain_valid, recent_audit_logs_count, access_review_complete  
   - Wire to Better Stack alerting  

8. **Implement quarterly access review automation hooks**  
   - Already script exists (`scripts/security/quarterly-access-review.js`)  
   - Add OTEL metric `access.review.completed` with quarter label  
   - Alert if review not started by day 1 of quarter  

9. **Conduct integration test for incident response**  
   - Simulate BYOK master key compromise  
   - Verify operator can trigger rotation via endpoint, monitor Inngest, verify completion  
   - Document gaps in runbook  

---

## Evidence Checklist

The following must exist to close this integration review:

- [ ] `docs/INCIDENT_RESPONSE.md` BYOK section updated with automated endpoint + Inngest monitoring
- [ ] `docs/admin-ops/audit-trail-template.md` created and referenced from handover docs
- [ ] `src/seed/telemetry/soc2-control-mapping.json` populated with at least 10 controls
- [ ] Honeycomb alerts created (screenshot in `docs/soc2/evidence/`)
- [ ] `byok-crypto.ts` dual-decrypt window referenced in incident response rollback steps
- [ ] Customer notification email template created (even if sending mechanism deferred)
- [ ] OTEL spans for `insertAuditLog` verified in staging traces
- [ ] SOC 2 report (`SOC2-TYPE1-READY-260621.md`) revised to remove "not yet implemented" for rotation

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Auditor finds fragmented audit trail | High | P1 (Control deficiency) | Standardize admin action logging before audit |
| Incident response fails during key rotation | Medium | P0 (Mass customer outage) | Update runbook with automated procedure; train second operator |
| Missing SOC 2 evidence from OTEL | High | P1 (Extra audit cost) | Add control mapping; generate 30-day reports pre-engagement |
| Deploy guard bypass not monitored | Low | P2 (Compliance finding) | Add OTEL metric for `DEPLOY_GUARD_OVERRIDE` count |
| Hash chain break undetected | Low | P0 (Audit integrity) | Already has daily cron — ensure alerting |

---

## Conclusion

The CTO and COO outputs are **functionally complete** at component level but **poorly integrated** at system level. The SOC 2 Type I readiness claim is premature without:
1. Unified audit trail for all admin actions
2. SOC 2-mapped observability
3. Aligned BYOK rotation incident procedures

**Next steps:**
1. Address blocking items (C1-C3) in 48 hours
2. Assign owner for each recommendation (CTO for technical, COO for runbooks)
3. Re-review after fixes before auditor engagement

**Verification needed:**
- Run integration test: Deploy guard approval → audit log → OTEL span → Honeycomb
- Run incident simulation: BYOK compromise → follow runbook → success?

---

**Report prepared by:** Claude (Code Reviewer)  
**Review scope:** Files in `plans/reports/`, `docs/`, and `src/` as listed  
**Cross-reference:** 
- `admin-operations-gap-260513-sophia.md` (ADM-09)
- `deploy-guard-admin-ui-260621.md`
- `SOC2-TYPE1-READY-260621.md`
- `INCIDENT_RESPONSE.md`
- `runbooks/KEY-ROTATION.md`
- `code-review-4g-byok-foundations.md`
- `code-reviewer-260531-1444-cross-cutting-security-edge-cases-report.md`

