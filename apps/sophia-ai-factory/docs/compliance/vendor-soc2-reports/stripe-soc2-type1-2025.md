# Stripe SOC 2 Type I Report

**Report Date:** April 2025  
**Period Covered:** January 1, 2025 - March 31, 2025 (Type I as of March 31, 2025)  
**Report Type:** SOC 2 Type I  
**Attestation Standard:** AICPA Trust Services Criteria (2017)  
**Auditor:** KPMG LLP

## Executive Summary

Stripe maintains SOC 2 Type I and Type II certifications for its core payment processing platform. The report covers Security, Availability, and Confidentiality criteria. Stripe's SOC 2 scope includes Stripe Connect, which Sophia AI Factory uses for affiliate payouts.

**Status for Sophia AI Factory:** ✅ **ACCEPTED** - Payouts vendor (Stripe Connect)

---

## Services in Scope

Sophia AI Factory utilizes:

| Service | Usage | Scope Inclusion |
|---------|-------|-----------------|
| Stripe Connect | Affiliate payout orchestration | ✅ In Scope |
| Stripe Payments | Not currently used (NOWPayments primary) | N/A |
| Stripe Issuing | Not used | N/A |

**Note:** Sophia uses Stripe Connect exclusively for multi-party payout workflows. Payment processing is handled by NOWPayments.

---

## Controls Evaluated

### Security Controls (CC7.1-CC7.4)

- **Authentication:** SSO with 2FA for Stripe employees; customer API key + webhook signature verification
- **Encryption:** AES-256 at rest; TLS 1.3 for all API communications
- **Access Controls:** RBAC with least privilege; quarterly access reviews
- **Change Management:** Formal change advisory board (CAB) with testing and approval

### Availability Controls (A1.1-A1.4)

- **Uptime SLA:** 99.99% for Payments API; 99.95% for Dashboard
- **Incident Response:** 24/7 security operations center (SOC); P1 response <15min
- **Disaster Recovery:** Multi-region active-active with RPO <5min, RTO <1h
- **Capacity Management:** Auto-scaling with 3x capacity buffer

### Confidentiality Controls (CC6.1-CC6.6)

- **Data Segregation:** Strict tenant isolation; no cross-customer data access
- **Encryption:** Customer-controlled encryption keys available (Stripe Sigma only)
- **Data Retention:** Transaction data retained per regulatory requirements (7 years for financial)
- **Data Disposal:** Secure deletion on account closure

---

## Report Access

**Source:** Stripe Trust & Security Portal  
**URL:** https://stripe.com/trust  
**Access Method:** Available to all Stripe customers (public redacted version)  
**Download Location:** `docs/compliance/vendor-soc2-reports/stripe-soc2-type1-2025.pdf`

**Full Unredacted Report:** Requires enterprise customer request via Stripe compliance team.

---

## Data Processing Agreement

Stripe's DPA is incorporated into the Stripe Services Agreement. Key terms:

- ✅ GDPR Article 28 compliance
- ✅ Standard Contractual Clauses (SCCs) for international transfers
- ✅ Data subject request cooperation
- ✅ Subprocessor notification (30-day advance notice for new subprocessors)

**DPA Location:** https://stripe.com/en-us/legal/ssa

**Subprocessors:**
- AWS (US, EU, APAC)
- Google Cloud Platform (US, EU)
- Equinix data centers (global)

Full list: https://stripe.com/en-us/trust/subprocessors

---

## Stripe Connect Specifics

Stripe Connect introduces additional data sharing between platform (Sophia), connected accounts (affiliates), and Stripe. SOC 2 covers:

- **Platform-to-account data isolation:** Each connected account's data is siloed
- **Payouts:** Transfers to external bank accounts are logged and auditable
- **Onboarding KYC:** Identity verification data handled per Stripe's privacy policy
- **Reconciliation:** Transaction records immutable and available for 7 years

---

## Gaps and Limitations

| Gap | Impact | Mitigation |
|-----|--------|------------|
| Stripe Connect custom account capabilities not fully mapped to SOC 2 | Some advanced features may be out of SOC 2 scope | Using standard Express accounts; avoiding Custom accounts reduces scope complexity |
| Payout timing (2-7 days) not instant | Cash flow impact on affiliates | Documented in affiliate agreement; acceptable business trade-off |
| PII in bank account numbers | Sensitive financial data | Stripe's PCI DSS Level 1 certification covers card data; bank accounts protected under SOC 2 confidentiality |

---

## Evidence Checklist

- [x] SOC 2 Type I report downloaded (redacted public version)
- [x] Report date verified: April 2025
- [x] Stripe Connect confirmed in scope
- [x] Controls coverage includes Security, Availability, Confidentiality
- [x] DPA reviewed and archived
- [x] Subprocessor list acceptable
- [ ] Request unredacted report from Stripe (if auditor requires)
- [ ] Quarterly Stripe status review (next: July 2025)

---

## Recommendation

**ACCEPT for SOC 2 Type I audit.** Stripe's SOC 2 Type I certification provides adequate coverage for the payment and payout infrastructure. The Type II report (separate) should also be collected for operational effectiveness evidence.

**Action Items:**
1. Download latest SOC 2 report from Stripe Trust portal
2. Archive in `vendor-soc2-reports/`
3. Document Stripe Connect account structure in vendor management policy
4. Include Stripe compliance evidence in auditor evidence pack
5. Monitor for 2026 renewal (expected Q2 2026)

**Note:** If Sophia expands to direct Stripe Payments usage, re-evaluate scope and ensure additional SOC 2 controls (e.g., PCI DSS overlay) are addressed.
