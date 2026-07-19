# Quarterly Access Review — Sophia AI Factory

**Status:** Active  
**Frequency:** Quarterly (due: 1st Monday of Mar, Jun, Sep, Dec)  
**Owner:** Founder / SOC 2 Compliance Officer  
**Related:** Task #49, Deploy Guard SOP, Secret Rotation Runbook

---

## 1. Mục đích / Purpose

Quarterly Access Review là cơ chế compliance để đảm bảo:

- **Principle of Least Privilege:** Users chỉ có quyền truy cập tối thiểu cần thiết.
- **Account Hygiene:** Tài khoản không sử dụng bị vô hiệu hóa.
- **Secret Rotation:** API keys và tokens được xoay theo lịch trình.
- **SOC 2 CC6.1:** Separation of duties và access controls được duy trì.

---

## 2. Phạm vi / Scope

Review bao gồm:

| Category | Data Source | Review Criteria |
|----------|-------------|-----------------|
| User Accounts | `users` table | Role assignment, last sign-in, account status |
| Admin/Ops Accounts | `users.role = 'admin'` | Active operators, DEPLOY_KEY possession |
| API Keys | `raas_api_keys` | Expiry, last used, permission scope |
| Deploy Guard History | `deploy_guard_approvals` | Attestation activity, emergency overrides |
| Audit Log | `admin_audit_log` | Suspicious access patterns |

---

## 3. Running the Review Script

### Prerequisites

- Wrangler CLI installed and authenticated (`npx wrangler whoami`)
- Access to production D1 database (`sophia-raas-db`)
- `python3` available for JSON processing

### Command

```bash
cd apps/sophia-ai-factory
./scripts/admin/quarterly-access-review.sh
```

**Output:**  
Report saved to `apps/sophia-ai-factory/reports/access-reviews/access-review-YYYY-MM-DD.md`

**Estimated runtime:** 2-5 minutes (depends on data volume).

---

## 4. Report Structure

The generated report contains:

```
# Quarterly Access Review Report
├── Executive Summary (totals, risk level)
├── 1. User Account Review
│   ├── Role breakdown
│   └── Dormant admin accounts (90+ days)
├── 2. API Keys & Service Tokens
│   ├── All keys with last used/expiry
│   └── Expired but active keys flag
├── 3. Deploy Guard Activity
│   ├── Recent approvals (90 days)
│   └── Emergency override count
├── 4. Admin Activity Review
│   ├── Deploy guard actions by type
│   └── Most active operators
├── 5. Secrets Rotation Status
│   └── Manual verification checklist
└── 6. Recommendations & Action Items
```

---

## 5. Review Criteria

### 5.1 User Accounts

| Check | Threshold | Action |
|-------|-----------|--------|
| Dormant admin (90+ days) | > 0 | Disable account, require re-verification |
| Unverified email | > 0 | Send verification reminder, disable after 30 days |
| Role escalation without approval | Any | Audit trail review, revert if unauthorized |

### 5.2 API Keys

| Check | Threshold | Action |
|-------|-----------|--------|
| Expired but active | > 0 | Deactivate key, notify org owner |
| Never used (>30 days) | > 5 | Flag for review, potential revocation |
| Wildcard permissions (`*`) | Any | Review necessity, restrict to specific scopes |

### 5.3 Deploy Guard

| Check | Threshold | Action |
|-------|-----------|--------|
| Emergency overrides (90d) | > 10 | Investigate root cause, process improvement |
| Rejected approvals (>10%) | > 10% | Review rejection reasons, training needed |
| Pending approvals (>24h) | > 0 | Escalate to secondary approvers |

---

## 6. Action Items & Remediation

After generating the report:

1. **High Risk Findings** (marked 🔴 in report):
   - Address within 48 hours
   - Document remediation steps
   - Re-run review script to verify fix

2. **Medium Risk Findings** (marked 🟡):
   - Address within 7 days
   - Update compliance documentation

3. **Low Risk Findings** (marked 🟢):
   - Acknowledge in report
   - Schedule for next quarterly review

### Remediation Commands

```bash
# Disable dormant user (example)
npx wrangler d1 execute sophia-raas-db --remote --command \
  "UPDATE users SET email_verified = 0 WHERE id = '<user-id>';"

# Deactivate expired API key
npx wrangler d1 execute sophia-raas-db --remote --command \
  "UPDATE raas_api_keys SET is_active = 0 WHERE id = '<key-id>';"

# Generate new DEPLOY_KEY for operator
./scripts/admin/rotate-deploy-key.sh <operator-email>
```

---

## 7. Submission & Sign-off

1. **Review meeting:** Schedule 30-minute session with Founder/CTO to review findings.
2. **Sign-off:** Both reviewer and approver sign the report footer.
3. **Archive:** Store in `reports/access-reviews/` and backup to R2 `sophia-compliance` bucket.
4. **Update tracking:** Log completion in quarterly compliance checklist.

---

## 8. Calendar & Reminders

| Quarter | Due Date | Responsible |
|---------|----------|-------------|
| Q1 (Mar) | 1st Monday | Founder |
| Q2 (Jun) | 1st Monday | Founder |
| Q3 (Sep) | 1st Monday | Founder |
| Q4 (Dec) | 1st Monday | Founder |

**Reminder automation:** Add to calendar with link to this runbook.

---

## 9. Escalation

If review reveals **critical security findings**:

1. **Immediate containment:** Disable affected accounts/keys.
2. **Incident response:** Trigger incident response runbook (`docs/INCIDENT_RESPONSE.md`).
3. **Customer notification:** If customer data potentially exposed, follow breach notification procedures.
4. **Auditor notification:** For SOC 2, report material weakness to auditor within 30 days.

---

## 10. References

- **Script:** `scripts/admin/quarterly-access-review.sh`
- **Report examples:** `reports/access-reviews/`
- **Deploy Guard SOP:** `docs/admin-ops/deploy-guard-sop.md`
- **Secret Rotation Runbook:** `docs/secret-rotation-runbook.md`
- **Incident Response:** `docs/INCIDENT_RESPONSE.md`
- **SOC 2 Controls:** `docs/audit_report.md`

---

**Last updated:** 2026-06-22  
**Next scheduled:** 2026-09-01 (Q3)
