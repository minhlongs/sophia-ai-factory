# Information Security Policy

**Version**: 1.0 | **Date**: 2026-06-12
**Owner**: CTO
**Approved by**: CEO
**Review cycle**: Annual

---

## 1. Purpose

This policy establishes the framework for protecting information assets at Sophia AI Factory. It defines roles, responsibilities, and controls required to ensure confidentiality, integrity, and availability of data.

## 2. Scope

Applies to:
- All employees, contractors, and interns
- All systems, networks, and data (production + non-production)
- All physical locations (office + remote)
- All third parties with access to our systems or data

## 3. Objectives

- Protect customer data from unauthorized access, disclosure, modification, or destruction
- Maintain service availability per published SLAs (99.9% target)
- Comply with applicable laws and regulations (GDPR, CCPA, EU AI Act)
- Meet contractual security obligations
- Enable business growth through customer trust

## 4. Principles

1. **Security by design**: Security controls integrated from the start, not bolted on
2. **Least privilege**: Access only what's needed for the role
3. **Defense in depth**: Multiple overlapping controls
4. **Zero trust**: Verify explicitly, never trust by default
5. **Continuous monitoring**: Detect + respond, not just prevent
6. **Transparency**: Document and share security posture with customers

---

## 5. Roles and Responsibilities

### CEO (Long Tho)

- Ultimate accountability for security
- Approves security strategy + budget
- Sign-off on high-risk decisions
- Quarterly security review with CTO

### CTO

- Owns + maintains this policy
- Owns technical security controls
- Approves architecture + tooling changes
- Leads incident response
- Approves security exceptions

### Engineering Lead

- Implements security controls in code
- Code review enforcement
- Vulnerability remediation
- DevSecOps practices
- Production access management

### All Employees

- Follow this policy + sub-policies
- Report security incidents immediately
- Complete annual security training
- Protect credentials + devices
- Lock screens when away

### Contractors / Third Parties

- Bound by contract + DPA
- Limited access per least privilege
- Same security requirements as employees

---

## 6. Data Classification

| Level | Examples | Controls |
|-------|----------|----------|
| Public | Marketing site, blog | None required |
| Internal | Org chart, policies | Auth required |
| Confidential | Customer data, source code | Encryption + access control |
| Restricted | Auth secrets, payment data | Encryption + MFA + audit logging |

### Handling requirements

| Level | At rest | In transit | Disposal |
|-------|---------|------------|----------|
| Public | None | TLS | Standard delete |
| Internal | Encrypted | TLS | Secure delete |
| Confidential | AES-256 | TLS 1.3 | Cryptographic erase |
| Restricted | AES-256 + HSM | TLS 1.3 + MFA | Physical destruction |

---

## 7. Access Control

### Authentication

- MFA required on all production systems
- MFA required on all admin accounts
- Password minimum 14 chars, complexity rules
- Password manager required (1Password enforced)
- No password reuse across systems
- 90-day password rotation for privileged accounts

### Authorization

- Role-based access control (RBAC)
- Least privilege by default
- Quarterly access reviews
- Immediate revocation on role change or termination

### Physical access

- Office: badge access + visitor logs
- Data centers: managed by Cloudflare (no direct access)
- Remote work: encrypted disks, screen privacy filters

---

## 8. System Security

### Workstations

- [ ] Full disk encryption (FileVault / BitLocker)
- [ ] Endpoint detection + response (CrowdStrike or similar)
- [ ] OS auto-updates enabled
- [ ] Screen lock ≤10 min idle
- [ ] No admin by default

### Production systems

- [ ] All access logged + monitored
- [ ] Secrets in Cloudflare Workers secrets (no plaintext)
- [ ] Database access via bastion only
- [ ] No direct internet exposure
- [ ] Daily vulnerability scans

### Network

- [ ] TLS 1.3 enforced (no TLS 1.0/1.1)
- [ ] WAF + DDoS protection (Cloudflare)
- [ ] Network segmentation (prod / staging / dev)
- [ ] VPN for admin access

---

## 9. Application Security

### Secure development

- Code review required (2+ reviewers for production)
- Static analysis (SAST) on every PR
- Dependency scanning on every PR
- Secrets detection on every commit
- Pre-commit hooks for sensitive files

### Testing

- Unit tests for security-critical code
- Integration tests for auth + authz
- Annual penetration test
- Quarterly vulnerability scans

### Deployment

- All changes via CI/CD (no manual deploys)
- Staging → production promotion requires approval
- Rollback plan documented for every change
- Blue/green deployment for zero-downtime

---

## 10. Incident Response

See `docs/runbooks/INCIDENT-RESPONSE-QUICKREF.md` for quick reference.
See `docs/INCIDENT-RESPONSE.md` for full plan (when written).

### Severity levels

- P0: Service down, data breach → 15 min response
- P1: Critical feature broken → 2 hour response
- P2: Degraded service → 24 hour response
- P3: Minor issue → 48 hour response

### Reporting

- Internal: Slack `#sec-incidents` channel
- Customer: Per contractual SLA (see DPA)
- Regulatory: Per legal requirements (≤72 hours for GDPR breach)
- Public: Status page for P0/P1

---

## 11. Business Continuity

### Backups

- D1 databases: Daily snapshots, 30-day retention
- R2 storage: Versioning enabled, 90-day retention
- Configuration: Git-backed, infinite retention
- Encryption keys: Backed up separately

### Disaster recovery

- RTO target: 4 hours
- RPO target: 1 hour
- DR test: Annual (next: {{NEXT_DR_TEST_DATE}})
- Failover: Multi-region via Cloudflare

### Pandemic / remote work

- All work can be done remotely
- VPN available for prod access
- Communication: Slack + Loom (async-first)

---

## 12. Vendor Management

### Selection

- Security review required for all new vendors (see `VENDOR-SECURITY-REVIEW.md`)
- DPA required if vendor processes customer data
- Cyber liability insurance required (≥$5M)

### Ongoing

- Annual review for all vendors processing customer data
- Continuous monitoring via compliance platform
- Incident notification within 24 hours

### Termination

- Data return + deletion within 30 days
- Certificate of destruction from vendor
- Final audit of access logs

---

## 13. Training and Awareness

- Onboarding: Security training within first week
- Annual: Full security refresher (all employees)
- Quarterly: Phishing simulation
- Ad-hoc: After any security incident
- Specialized: For engineers (secure coding), AMs (data handling)

---

## 14. Compliance

| Regulation | Applies? | Owner |
|------------|----------|-------|
| GDPR | Yes | CTO + Legal |
| CCPA/CPRA | Yes | CTO + Legal |
| EU AI Act | Yes (from 2026-08-02) | CTO + Product |
| DMCA | Yes (user content) | Legal |
| SOC 2 Type I | Q1 2027 target | CTO |
| ISO 27001 | Year 2+ consideration | CTO |

---

## 15. Exceptions

Any exception to this policy must be:

1. Documented (including risk acceptance)
2. Approved by CTO
3. Time-limited (max 90 days, renewable)
4. Logged in exception register

---

## 16. Enforcement

Violations may result in:
- Disciplinary action (up to termination)
- Contractual penalties (for vendors)
- Legal action (if illegal)
- Regulatory reporting (if required)

---

## 17. Review

This policy reviewed annually (next: 2027-06-12) or upon material change.

Changes require CEO approval.

---

## 18. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CEO | Long Tho | 2026-06-12 | |
| CTO | | | |

---

**Last reviewed**: 2026-06-12
**Next review**: 2027-06-12
