# Vendor Security Review Template

**Version**: 1.0 | **Date**: 2026-06-12
**Owner**: CTO + COO
**Cadence**: Annual review + upon material change

---

## When to Use

Complete this review before:

- Engaging new vendor that processes customer data
- Renewing existing vendor contract
- Vendor announces security incident
- Material change in vendor's services or data handling

---

## Vendor Information

| Field | Answer |
|-------|--------|
| Vendor name | {{VENDOR_NAME}} |
| Service provided | {{SERVICE}} |
| Date of review | {{REVIEW_DATE}} |
| Reviewer | {{REVIEWER_NAME}} |
| Annual contract value | {{ACV}} |
| Data classification (highest) | Public / Internal / Confidential / Restricted |

---

## 1. Data Handling

### What data will the vendor access?

- [ ] Customer personal data (names, emails)
- [ ] Customer content (posts, images, videos)
- [ ] Customer business data (analytics, revenue)
- [ ] Employee data
- [ ] Authentication credentials (tokens, API keys)
- [ ] No data (vendor processes in isolation)

### Data residency

| Field | Answer |
|-------|--------|
| Storage region | {{STORAGE_REGION}} |
| Processing region | {{PROCESSING_REGION}} |
| Backup region | {{BACKUP_REGION}} |

### Data flows

Describe how data moves between our systems and vendor:

```
[Customer] → [Our App] → [Vendor API] → [Vendor Storage] → [Vendor Processing]
```

---

## 2. Security Controls

### Certifications

| Certification | Status | Expiration |
|---------------|--------|------------|
| SOC 2 Type II | Yes/No/In progress | {{EXP_DATE}} |
| ISO 27001 | Yes/No | {{EXP_DATE}} |
| HIPAA | Yes/No/N/A | {{EXP_DATE}} |
| PCI DSS | Yes/No/N/A | {{EXP_DATE}} |
| GDPR compliant | Yes/No | N/A |
| Other | | |

### Encryption

| Requirement | Vendor confirms? |
|-------------|------------------|
| TLS 1.2+ in transit | Yes/No |
| AES-256 at rest | Yes/No |
| BYOK (bring your own key) supported | Yes/No/N/A |

### Access controls

| Requirement | Vendor confirms? |
|-------------|------------------|
| MFA on all admin accounts | Yes/No |
| Role-based access control | Yes/No |
| Least privilege enforced | Yes/No |
| Quarterly access reviews | Yes/No |

### Vulnerability management

| Requirement | Vendor confirms? |
|-------------|------------------|
| Regular penetration testing | Yes/No |
| Public bug bounty program | Yes/No |
| Responsible disclosure policy | Yes/No |
| Patch SLA (critical: 7 days) | Yes/No |

### Incident response

| Requirement | Vendor confirms? |
|-------------|------------------|
| Documented IR plan | Yes/No |
| Customer breach notification (≤72 hours) | Yes/No |
| Annual IR testing | Yes/No |

---

## 3. Compliance

### Regulatory

| Regulation | Applies? | Vendor compliance? |
|------------|----------|---------------------|
| GDPR | Yes/No | Yes/No |
| CCPA/CPRA | Yes/No | Yes/No |
| HIPAA | Yes/No/N/A | Yes/No/N/A |
| EU AI Act | Yes/No | Yes/No |

### Sub-processors

Vendor uses sub-processors?

- [ ] No
- [ ] Yes → list attached as Appendix A

### International transfers

- [ ] No cross-border transfer
- [ ] EU-US Data Privacy Framework
- [ ] Standard Contractual Clauses (SCCs)
- [ ] Other: {{OTHER_MECHANISM}}

---

## 4. Business Continuity

| Requirement | Vendor confirms? |
|-------------|------------------|
| Documented BCP | Yes/No |
| Documented DR plan | Yes/No |
| RTO (recovery time objective) | {{HOURS}} hours |
| RPO (recovery point objective) | {{HOURS}} hours |
| Annual DR testing | Yes/No |
| Uptime SLA | {{SLA}}% |

---

## 5. Contractual

### Required clauses

- [ ] Data Processing Agreement (DPA) signed
- [ ] Confidentiality / NDA
- [ ] Audit rights (annual + for-cause)
- [ ] Termination + data return/deletion clause
- [ ] Indemnification for vendor breach
- [ ] Cyber liability insurance (≥$5M)
- [ ] SLA with credits for breach
- [ ] Sub-processor approval workflow

### Termination

| Field | Detail |
|-------|--------|
| Notice period | {{DAYS}} days |
| Data export format | {{FORMAT}} |
| Data deletion timeline | {{DAYS}} days post-termination |

---

## 6. Risk Assessment

### Inherent risk (before controls)

| Risk | Likelihood | Impact | Score |
|------|------------|--------|-------|
| Data breach | L/M/H | L/M/H | {{SCORE}} |
| Service outage | L/M/H | L/M/H | {{SCORE}} |
| Vendor lock-in | L/M/H | L/M/H | {{SCORE}} |
| Compliance violation | L/M/H | L/M/H | {{SCORE}} |

### Residual risk (after controls)

| Risk | Score | Acceptable? |
|------|-------|-------------|
| Data breach | {{RESIDUAL}} | Yes/No |
| Service outage | {{RESIDUAL}} | Yes/No |
| Vendor lock-in | {{RESIDUAL}} | Yes/No |
| Compliance violation | {{RESIDUAL}} | Yes/No |

---

## 7. Decision

**Risk tier**: Low / Medium / High

**Decision**: ☐ Approve ☐ Approve with conditions ☐ Reject

**Conditions** (if any):
1. {{CONDITION_1}}
2. {{CONDITION_2}}

**Re-review date**: {{NEXT_REVIEW}}

---

## 8. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CTO | | | |
| COO | | | |
| Legal (if High risk) | | | |
| CEO (if >$50k ACV) | Long Tho | | |

---

## Appendix A: Sub-processors

| Name | Service | Region | DPA on file? |
|------|---------|--------|--------------|
| {{SUB_1}} | {{SVC_1}} | {{REGION_1}} | Yes/No |
| {{SUB_2}} | {{SVC_2}} | {{REGION_2}} | Yes/No |

---

**Last reviewed**: {{REVIEW_DATE}}
**Next review**: {{NEXT_REVIEW}}
