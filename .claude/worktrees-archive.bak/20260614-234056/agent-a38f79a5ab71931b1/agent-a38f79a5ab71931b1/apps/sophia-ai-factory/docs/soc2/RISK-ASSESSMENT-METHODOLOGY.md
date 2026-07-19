# Risk Assessment Methodology

**Version**: 1.0 | **Date**: 2026-06-12
**Owner**: CTO
**Approved by**: CEO
**Review cycle**: Annual + quarterly updates

---

## 1. Purpose

Establish a consistent, repeatable methodology for identifying, assessing, and treating risks to Sophia AI Factory's information assets, customers, and operations.

## 2. Scope

All risks affecting:
- Customer data (confidentiality, integrity, availability)
- Internal systems and data
- Third-party services
- Compliance obligations
- Reputation
- Financial health

## 3. Risk Assessment Framework

### Step 1: Identify risks

Methods:
- [ ] Asset inventory review
- [ ] Threat modeling (STRIDE, PASTA, or similar)
- [ ] Incident history analysis
- [ ] Industry threat intelligence
- [ ] Vendor risk reports
- [ ] Employee surveys
- [ ] Customer feedback

Output: Risk register with 50-200 risks depending on size

---

### Step 2: Analyze risks

For each risk, assess:

#### Likelihood

| Score | Likelihood | Description |
|-------|------------|-------------|
| 1 | Rare | <5% per year, no known incidents in industry |
| 2 | Unlikely | 5-25% per year, few industry incidents |
| 3 | Possible | 25-50% per year, some industry incidents |
| 4 | Likely | 50-75% per year, multiple industry incidents |
| 5 | Almost certain | >75% per year, regular incidents in our company |

#### Impact

| Score | Impact | Financial | Customer | Reputation |
|-------|--------|-----------|----------|------------|
| 1 | Negligible | <$1k | No impact | No impact |
| 2 | Minor | $1k-$10k | 1-10 customers annoyed | Internal only |
| 3 | Moderate | $10k-$100k | 10-100 customers affected | Local media coverage |
| 4 | Major | $100k-$1M | 100-1000 customers affected | National media coverage |
| 5 | Catastrophic | >$1M | >1000 customers or major customer lost | Industry-wide coverage, regulatory action |

#### Inherent risk score

```
Risk Score = Likelihood × Impact
```

| Score | Tier | Action required |
|-------|------|-----------------|
| 1-4 | Low | Monitor, accept |
| 5-9 | Medium | Treat within 90 days |
| 10-15 | High | Treat within 30 days |
| 16-25 | Critical | Treat immediately, executive escalation |

---

### Step 3: Evaluate controls

For each risk, identify existing controls and their effectiveness:

| Effectiveness | Description |
|---------------|-------------|
| Ineffective | Controls don't exist or don't work |
| Partially effective | Some controls exist but gaps remain |
| Mostly effective | Controls exist, minor gaps |
| Effective | Controls fully address the risk |
| Highly effective | Controls exceed requirements |

#### Residual risk

```
Residual Risk = Inherent Risk × (1 - Control Effectiveness)
```

Where Control Effectiveness:
- Ineffective: 0%
- Partially effective: 25%
- Mostly effective: 50%
- Effective: 75%
- Highly effective: 90%

---

### Step 4: Treat risks

Treatment options:

1. **Mitigate**: Implement controls to reduce likelihood or impact
2. **Transfer**: Outsource risk (insurance, contract, outsourcing)
3. **Avoid**: Eliminate the risk by removing the activity
4. **Accept**: Acknowledge the risk, document rationale, monitor

#### Treatment plan

For each risk to be treated, document:
- Action items (specific, time-bound)
- Owner
- Due date
- Budget
- Expected residual risk after treatment

---

### Step 5: Monitor and review

- Quarterly: Update risk register, review treatment plans
- Annually: Full re-assessment
- Ad-hoc: After major incidents, infrastructure changes, new threats

---

## 4. Risk Categories

### 4.1 Security Risks

| Risk | L | I | Score | Treatment |
|------|---|---|-------|-----------|
| Data breach via API vulnerability | 3 | 5 | 15 | SAST/DAST, pen testing, WAF |
| Phishing attack on employee | 4 | 3 | 12 | Training, MFA, email filtering |
| Ransomware on production | 2 | 5 | 10 | Backups, EDR, network segmentation |
| DDoS attack | 3 | 3 | 9 | Cloudflare protection, rate limiting |
| Insider threat | 2 | 5 | 10 | Least privilege, audit logs, background checks |
| Supply chain attack via vendor | 2 | 4 | 8 | Vendor reviews, SBOM, monitoring |

### 4.2 Availability Risks

| Risk | L | I | Score | Treatment |
|------|---|---|-------|-----------|
| Cloudflare region outage | 2 | 4 | 8 | Multi-region, failover plan |
| D1 database failure | 2 | 4 | 8 | Backups, replication |
| R2 storage failure | 1 | 3 | 3 | Versioning, replication |
| Stripe outage | 2 | 3 | 6 | Queue + retry |
| Network outage (user side) | 4 | 1 | 4 | CDN, offline support (P3) |

### 4.3 Compliance Risks

| Risk | L | I | Score | Treatment |
|------|---|---|-------|-----------|
| GDPR violation | 3 | 5 | 15 | DPA, data mapping, training |
| CCPA violation | 2 | 4 | 8 | Privacy policy, data subject rights |
| EU AI Act violation | 3 | 4 | 12 | Disclosure, marking, transparency |
| SOC 2 finding | 3 | 3 | 9 | Audit prep, remediation |
| DMCA takedown miss | 2 | 2 | 4 | Designated agent, process |

### 4.4 Operational Risks

| Risk | L | I | Score | Treatment |
|------|---|---|-------|-----------|
| Key engineer departure | 3 | 3 | 9 | Documentation, cross-training, retention |
| Critical vendor bankruptcy | 2 | 4 | 8 | Multi-vendor strategy, contracts |
| Pandemic / remote work | 3 | 2 | 6 | Fully remote-capable already |
| Natural disaster (office) | 1 | 2 | 2 | No office-dependent operations |

### 4.5 Financial Risks

| Risk | L | I | Score | Treatment |
|------|---|---|-------|-----------|
| Customer concentration (>30% rev) | 3 | 4 | 12 | Diversification, multi-tenant strategy |
| Currency fluctuation | 2 | 2 | 4 | USD billing primary |
| Funding shortage | 2 | 5 | 10 | Runway management, revenue focus |
| Cyber liability claim | 2 | 4 | 8 | Insurance, security controls |

### 4.6 Reputational Risks

| Risk | L | I | Score | Treatment |
|------|---|---|-------|-----------|
| Public security breach | 2 | 5 | 10 | IR plan, transparency, comms |
| Customer churn wave | 2 | 4 | 8 | CS playbook, retention focus |
| Negative press | 2 | 3 | 6 | PR strategy, customer advocacy |
| AI misuse scandal | 2 | 4 | 8 | Acceptable use policy, monitoring |

---

## 5. Risk Register

Maintained in: `tenants/_internal/risk-register.md` (TODO)

Required fields per risk:
- Risk ID
- Description
- Category
- Inherent likelihood + impact + score
- Existing controls + effectiveness
- Residual score
- Treatment decision + plan
- Owner
- Review date
- Status

---

## 6. Risk Appetite

### Tolerance levels

| Category | Appetite |
|----------|----------|
| Customer data breach | Very low (must be ≤Medium residual) |
| Service availability | Low (target 99.9%, accept ≤99.5%) |
| Compliance violation | Very low (must be ≤Low residual) |
| Financial loss | Medium (accept up to $100k/year) |
| Reputation | Low (no catastrophic events) |

### Escalation

- Critical risk (16-25): Immediate CEO + CTO notification
- High risk (10-15): Weekly leadership review
- Medium risk (5-9): Monthly review
- Low risk (1-4): Quarterly review

---

## 7. Risk Treatment Plan Template

For each risk being treated:

| Field | Value |
|-------|-------|
| Risk ID | R-001 |
| Description | ... |
| Inherent score | 15 |
| Current residual | 12 |
| Target residual | 4 |
| Treatment | Mitigate |
| Action items | 1. Implement WAF 2. Add rate limiting 3. Pen test |
| Owner | Engineering Lead |
| Due date | 2026-09-01 |
| Budget | $15k |
| Status | In progress |

---

## 8. Monitoring

### Key risk indicators (KRIs)

Track monthly:
- Number of vulnerabilities discovered (critical + high)
- Phishing test failure rate
- Vendor security incidents
- Compliance training completion rate
- Access review completion rate
- Backup test pass rate
- Mean time to detect/respond

### Thresholds

If any KRI breaches threshold for 2 consecutive months → escalate to leadership.

---

## 9. Reporting

### Monthly

- Risk register update
- Treatment plan progress
- New risks identified
- Closed risks

### Quarterly

- Full risk review with leadership
- Risk register refresh
- Treatment plan adjustments

### Annually

- Full re-assessment
- Methodology review
- Risk appetite review with board
- Update for new threats / regulations

---

## 10. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CEO | Long Tho | 2026-06-12 | |
| CTO | | | |

---

**Last reviewed**: 2026-06-12
**Next review**: 2027-06-12 (full) + quarterly updates
