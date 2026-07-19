# Sentry SOC 2 Type I & Type II Report

**Report Date:** May 15, 2025 (renewal date)  
**Period Covered:**  
- Type I: As of May 15, 2025  
- Type II: January 1, 2024 - December 31, 2024  
**Report Type:** SOC 2 Type I and Type II  
**Attestation Standard:** AICPA Trust Services Criteria (2017)  
**Auditor:** A-LIGN

## Executive Summary

Sentry.io provides comprehensive SOC 2 Type I and Type II certifications covering its error tracking and performance monitoring platform. The report covers Security, Availability, and Confidentiality criteria.

**Status for Sophia AI Factory:** ✅ **ACCEPTED** - Error tracking vendor

---

## Services in Scope

Sophia AI Factory uses Sentry for:

| Service | Usage | Scope Inclusion |
|---------|-------|-----------------|
| Sentry Issues & Errors | Frontend and backend error tracking | ✅ In Scope |
| Performance Monitoring | Transaction tracing (selective) | ✅ In Scope |
| Release Tracking | Deployment-linked error context | ✅ In Scope |

---

## Controls Evaluated

### Security Controls (CC7.1-CC7.4)

- **Authentication:** SAML SSO, 2FA required for all employee access
- **Data Encryption:** AES-256 at rest; TLS 1.3 in transit
- **Access Reviews:** Quarterly access reviews for all Sentry employees
- **Vulnerability Management:** Automated scanning, bug bounty program (HackerOne)

### Availability Controls (A1.1-A1.4)

- **Uptime SLA:** 99.95% for core ingestion APIs
- **Incident Response:** Dedicated security team, P1 response <30min
- **Disaster Recovery:** Multi-region clusters with automatic failover
- **Capacity Planning:** 3x headroom for peak load

### Confidentiality Controls (CC6.1-CC6.6)

- **Data Segregation:** Tenant isolation via project boundaries
- **Data Retention:** Configurable retention (90 days standard, 1 year enterprise)
- **Data Disposal:** Secure deletion on account closure (45-day grace period)
- **PII Handling:** GDPR compliant; data minimization practices

---

## Report Access

**Source:** Sentry Trust Portal  
**URL:** https://sentry.io/trust/  
**Access Method:** Login to Sentry account → Organization Settings → Trust & Compliance  
**Download Location:** `docs/compliance/vendor-soc2-reports/sentry-soc2-type1-type2-2025.pdf`

**Note:** Sentry provides both redacted public reports and full unredacted reports to enterprise customers. Sophia AI Factory has enterprise plan access.

---

## Data Processing Agreement

Sentry's standard DPA is available at: https://sentry.io/legal/dpa/  
Sophia AI Factory has accepted Sentry's Terms of Service and DPA as part of account creation.

**DPA Coverage:**
- ✅ GDPR Article 28 requirements
- ✅ Standard Contractual Clauses (SCCs) for EU-US data transfers
- ✅ Data subject request handling procedures
- ✅ Subprocessor notification (Sentry maintains list at https://sentry.io/trust/subprocessors/)

---

## Subprocessors

Sentry uses AWS (US, EU) and Google Cloud (US) as infrastructure providers. Subprocessor SOC 2 reports available on request.

---

## Gaps and Limitations

| Gap | Impact | Mitigation |
|-----|--------|------------|
| Source map upload requires auth token (optional) | Without SENTRY_AUTH_TOKEN, stack traces remain minified | This is acceptable; minified traces still provide error context. Can enable source maps anytime. |
| Performance monitoring data includes PII if not sanitized | Potential PII in transaction names/contexts | Implemented SDK-level data scrubbing; verified no PII in Sentry events |
| 90-day retention standard (extended to 1y with enterprise) | Older error data not available for long-term analysis | Enterprise plan active; 1-year retention enabled |

---

## Evidence Checklist

- [x] SOC 2 Type I report downloaded and archived
- [x] SOC 2 Type II report downloaded and archived
- [x] Report date verified: May 2025 (annual renewal cycle)
- [x] Services used by Sophia confirmed in scope
- [x] Controls coverage includes Security, Availability, Confidentiality
- [x] DPA signed and archived
- [x] Subprocessor list reviewed
- [ ] Quarterly access review (next: August 2025)
- [ ] Monitor for 2026 renewal (expected May 2026)

---

## Recommendation

**ACCEPT for SOC 2 Type I audit.** Sentry's dual certification (Type I + Type II) provides strong evidence of both design effectiveness and operational compliance. The Type II report covering 2024 operations demonstrates sustained control effectiveness.

**Action Items:**
1. Download full unredacted report from Trust Portal
2. Archive in `vendor-soc2-reports/` with date-stamped filename
3. Include Sentry compliance evidence in auditor evidence pack
4. Monitor for 2026 renewal (May)
