# SOC 2 Type I Readiness Checklist

**Version**: 1.0 | **Date**: 2026-06-12
**Target audit window**: Q4 2026 (Type I)
**Target report date**: Q1 2027

---

## Scope

**System**: Sophia AI Factory multi-tenant SaaS platform
**Trust Services Criteria (TSCs)**: TBD — see decision matrix below

### TSC Selection Decision Matrix

| TSC | Recommended? | Rationale |
|-----|--------------|-----------|
| Security (Common Criteria) | ✅ Yes | Required baseline for SOC 2 |
| Availability | ✅ Yes | Core promise to customers (99.9% uptime) |
| Confidentiality | ⚠️ Consider | Multi-tenant data separation matters |
| Processing Integrity | ❌ Defer | AI outputs are non-deterministic, hard to attest |
| Privacy | ⚠️ Consider | GDPR + CCPA already covered separately |

**Recommendation**: Start with Security + Availability + Confidentiality (3 TSCs).
**Alternative**: All 5 TSCs for enterprise customers who demand it.

**Decision needed**: Confirm 3 vs 5 TSCs before audit kickoff.

---

## Phase 1: Readiness Assessment (Weeks 1-4)

### Gap Analysis

- [ ] Inventory all systems in scope (Workers, D1, R2, Stripe, Slack)
- [ ] Document data flows (input → processing → output → storage)
- [ ] Map controls to TSC criteria (Common Criteria 1-33, plus selected TSCs)
- [ ] Identify gaps in current control environment
- [ ] Prioritize gaps by risk (High/Medium/Low)
- [ ] Create remediation roadmap with owners + dates

### Documentation Inventory

Check if these exist:

- [ ] Information Security Policy
- [ ] Acceptable Use Policy
- [ ] Access Control Policy
- [ ] Change Management Policy
- [ ] Incident Response Plan
- [ ] Business Continuity Plan
- [ ] Disaster Recovery Plan
- [ ] Vendor Management Policy
- [ ] Data Classification Policy
- [ ] Encryption Standards
- [ ] Backup and Retention Policy
- [ ] Code of Conduct
- [ ] Risk Assessment Methodology

### Tools

- [ ] Select compliance management platform (Vanta, Drata, Secureframe, Tugboat Logic)
- [ ] Configure continuous monitoring (cloud config, endpoint, identity)
- [ ] Set up evidence collection automation

---

## Phase 2: Policy Development (Weeks 5-8)

### Core Policies to Author

| Policy | Owner | Due |
|--------|-------|-----|
| Information Security Policy | CTO | Week 5 |
| Acceptable Use Policy | CTO | Week 5 |
| Access Control Policy | Engineering Lead | Week 6 |
| Change Management Policy | Engineering Lead | Week 6 |
| Incident Response Plan | Engineering Lead | Week 7 (already drafted) |
| Business Continuity Plan | Engineering Lead | Week 7 |
| Disaster Recovery Plan | Engineering Lead | Week 7 |
| Vendor Management Policy | COO | Week 8 |
| Data Classification Policy | CTO | Week 8 |
| Risk Assessment Methodology | CTO | Week 8 |

### Policy Template

Each policy must include:
- Purpose
- Scope
- Definitions
- Roles and responsibilities
- Control procedures
- Exceptions process
- Enforcement
- Review cycle (annual minimum)
- Approval signatures

---

## Phase 3: Control Implementation (Weeks 9-16)

### Common Criteria (Security) Controls

#### CC1: Control Environment

- [ ] Code of Conduct published + acknowledged by all employees
- [ ] Org chart documented + updated quarterly
- [ ] Background checks for all new hires
- [ ] Security awareness training (annual)
- [ ] Performance reviews include security KPIs

#### CC2: Communication and Information

- [ ] Internal security updates monthly
- [ ] Customer-facing security documentation (this checklist + policies)
- [ ] Incident reporting channels documented
- [ ] Status page public

#### CC3: Risk Assessment

- [ ] Annual risk assessment documented
- [ ] Risk register maintained
- [ ] Risk treatment plans for high risks
- [ ] Third-party risk assessments

#### CC4: Monitoring Activities

- [ ] Continuous vulnerability scanning
- [ ] Quarterly penetration tests
- [ ] Configuration monitoring (cloud)
- [ ] Anomaly detection on critical systems

#### CC5: Control Activities

- [ ] Segregation of duties enforced
- [ ] Approval workflows for changes
- [ ] Least privilege access
- [ ] Defense in depth (multiple security layers)

#### CC6: Logical and Physical Access

- [ ] MFA enforced on all systems
- [ ] Quarterly access reviews
- [ ] Privileged access management (PAM)
- [ ] Background checks for employees with data access
- [ ] Physical access controls (office, data centers)
- [ ] Visitor logs maintained

#### CC7: System Operations

- [ ] Incident detection + response (24/7)
- [ ] Backup procedures (daily minimum)
- [ ] Monitoring + alerting on all critical systems
- [ ] Capacity planning documented

#### CC8: Change Management

- [ ] All changes documented + approved
- [ ] Code review required (2+ reviewers for production)
- [ ] Automated testing before deploy
- [ ] Rollback plan documented
- [ ] Change advisory board for major changes

#### CC9: Risk Mitigation

- [ ] Vendor risk assessments
- [ ] Business interruption insurance
- [ ] Cyber liability insurance
- [ ] Contracts include security requirements

### Availability Controls (A1)

- [ ] 99.9% uptime SLA documented + measured
- [ ] Redundancy across regions
- [ ] Load testing quarterly
- [ ] Failover procedures tested annually
- [ ] Backup + restore tested quarterly

### Confidentiality Controls (C1)

- [ ] Data classification (Public, Internal, Confidential, Restricted)
- [ ] Encryption at rest (AES-256)
- [ ] Encryption in transit (TLS 1.3)
- [ ] D1 database isolation per tenant
- [ ] Secrets management (no plaintext credentials)
- [ ] Data retention + deletion procedures

---

## Phase 4: Evidence Collection (Weeks 17-20)

### Continuous Evidence

- [ ] Cloud configuration scans (weekly)
- [ ] Endpoint security scans (weekly)
- [ ] Identity provider logs (continuous)
- [ ] Code commit history (continuous)
- [ ] Access logs (continuous)
- [ ] Backup logs (continuous)

### Point-in-Time Evidence

- [ ] Policy acknowledgments (annual)
- [ ] Training completion (annual)
- [ ] Risk assessment (annual)
- [ ] Penetration test report (annual)
- [ ] DR test results (annual)
- [ ] Business continuity test (annual)
- [ ] Vendor reviews (annual)

### Auditor-Requested Evidence

- [ ] Sample of changes (CC8)
- [ ] Sample of access reviews (CC6)
- [ ] Sample of incidents + response (CC7)
- [ ] Sample of risk assessments (CC3)

---

## Phase 5: Pre-Audit (Weeks 21-24)

### Internal Audit

- [ ] Hire external auditor (Big 4 or mid-tier like Schellman, A-LIGN, BARR Advisory)
- [ ] Conduct readiness assessment (1-2 weeks)
- [ ] Remediate any gaps identified
- [ ] Final policy review + approval
- [ ] All employees complete security training refresher

### Auditor Selection Criteria

- AICPA-registered firm
- SOC 2 experience (50+ reports)
- References from similar companies
- Fixed-fee pricing
- 6-8 week audit timeline

**Estimated cost**: $25k-75k for Type I (3 TSCs), $50k-150k for Type I (5 TSCs).

---

## Phase 6: Audit (Weeks 25-32)

### Type I Audit (point-in-time)

- [ ] Kickoff meeting with auditor
- [ ] Evidence submission (1-2 weeks)
- [ ] Auditor testing (2-4 weeks)
- [ ] Draft report review
- [ ] Management response (if findings)
- [ ] Final report issued

### Common Findings + Pre-emptive Fixes

| Common Finding | Pre-emptive Fix |
|----------------|-----------------|
| Missing MFA on admin accounts | Enforce MFA via IdP before audit |
| Unpatched vulnerabilities | Monthly patching + scanning |
| Insufficient logging | Centralized logging + 90-day retention |
| No formal change management | Implement change advisory board |
| Missing DR test | Conduct DR test 30 days before audit |
| Incomplete access reviews | Quarterly reviews with documentation |

---

## Phase 7: Report Issuance + Maintenance (Ongoing)

### Type I Report

- Auditor's opinion on control design at point-in-time
- Description of system + controls
- Tests of controls + results
- Any exceptions noted

### Type II (Next Year)

- Type I + tests of operating effectiveness over 6-12 month period
- Required for most enterprise customers

### Ongoing Maintenance

- Quarterly internal control reviews
- Annual policy review + update
- Continuous monitoring via compliance platform
- Annual readiness re-assessment
- Type II audit in Year 2

---

## Budget Estimate

| Item | Cost |
|------|------|
| Compliance platform (Vanta/Drata) | $15k-30k/year |
| External auditor (Type I) | $25k-75k |
| Penetration test | $10k-25k |
| Policy authoring (internal time) | $5k-10k |
| Readiness consultant (optional) | $20k-50k |
| Cyber insurance | $5k-15k/year |
| **Total Year 1** | **$80k-205k** |

---

## Timeline Summary

| Phase | Duration | End Date |
|-------|----------|----------|
| Readiness assessment | 4 weeks | Week 4 |
| Policy development | 4 weeks | Week 8 |
| Control implementation | 8 weeks | Week 16 |
| Evidence collection | 4 weeks | Week 20 |
| Pre-audit + remediation | 4 weeks | Week 24 |
| Audit | 6-8 weeks | Week 32 |
| **Total** | **8 months** | |

Start date: 2026-07-01 → Type I report: 2027-03-01

---

## Decision Points

Before kicking off, decide:

1. **3 TSCs (Security + Availability + Confidentiality)** vs **5 TSCs (all)**?
2. **Auditor**: Big 4 (Deloitte, PwC, EY, KPMG) vs mid-tier (Schellman, A-LIGN)?
3. **Compliance platform**: Vanta vs Drata vs Secureframe vs Tugboat Logic?
4. **Budget approval**: $80k-205k for Year 1?

---

**Last reviewed**: 2026-06-12
**Next review**: After auditor selection
