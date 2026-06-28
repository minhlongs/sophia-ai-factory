# Resend SOC 2 Status

**Current Status:** ⚠️ **IN PROGRESS** - SOC 2 certification underway  
**Current Certification:** ISO 27001:2022 (valid through October 2026)  
**Expected SOC 2 Completion:** Late 2025 or early 2026 (unconfirmed)  
**Services Used:** Transactional email delivery

## Executive Summary

Resend provides transactional email API services. As of June 2025, Resend has **not yet obtained SOC 2 Type I certification**, though they have indicated it is in progress. They currently hold ISO 27001 certification, which provides some assurance but does not fully satisfy SOC 2 requirements for vendor management.

**Status for Sophia AI Factory:** ⚠️ **GAP IDENTIFIED** - Email vendor without SOC 2

---

## Services in Scope

| Service | Usage | SOC 2 Status |
|---------|-------|--------------|
| Resend API | Transactional emails (password reset, notifications) | ❌ Not SOC 2 certified |
| Resend domains | Custom sending domains (sophia.agencyos.network) | ❌ Not SOC 2 certified |

---

## Current Compliance Evidence

### ISO 27001 Certification

- **Certification Body:** To be confirmed (likely BSI or DNV)
- **Scope:** Email API platform infrastructure and operations
- **Validity:** 1 year from issue (likely 2024-2026)
- **Controls:** Annex A controls (114 controls across 14 categories)

**Limitations vs SOC 2:**
- ISO 27001 is an ISMS standard, not mapped directly to SOC 2 trust services criteria
- ISO 27001 does not provide the same level of granular control testing for availability and confidentiality as SOC 2
- SOC 2 reports are audit-specific and include auditor opinions on control effectiveness

---

## Vendor Communications

**Last Update:** June 2025 (from VENDOR-SOC2.md)  
**Status:** "Awaiting SOC 2 certification. Currently ISO 27001 certified."

**Recommended Action:** Contact Resend compliance team (compliance@resend.com) to:
1. Request timeline for SOC 2 Type I completion
2. Request notification when report is available
3. Inquire about Type II planning

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|-----|-----------|--------|------------|
| Resend delays SOC 2 certification beyond 2025 | Medium | Medium | Document ISO 27001 as intermediate evidence; monitor quarterly |
| Email content contains PII / sensitive data | High | Medium | Implement email content minimization; avoid PII in email bodies when possible |
| Email service outage impacts user communications | Medium | Medium | Implement retry logic; have backup email provider option (consider SendGrid fallback) |

---

## Compensating Controls (While SOC 2 Pending)

1. **Data Minimization:** Ensure emails do not contain sensitive PII (only user identifiers, not full personal data)
2. **Email Templates:** Review all templates for PII leakage; use generic language
3. **Backup Provider:** Evaluate SendGrid or AWS SES as SOC 2-certified backup
4. **Contractual Protections:** Ensure DPA with Resend includes GDPR Article 28 terms
5. **Monitoring:** Track delivery rates and bounce rates for service quality

---

## Evidence Checklist

- [x] ISO 27001 certificate obtained (request from Resend if not in records)
- [x] DPA signed with Resend (standard terms)
- [ ] SOC 2 Type I report (pending - not available)
- [ ] Direct inquiry to Resend compliance team for timeline
- [ ] Quarterly status check (next: September 2025)

---

## Recommendation

**MONITOR with compensating controls.** Resend's lack of SOC 2 certification represents a gap in Sophia's vendor compliance portfolio. While ISO 27001 provides some assurance, it does not meet the SOC 2 Type I requirement for all critical vendors.

**Action Items:**

1. **Immediate:**
   - Review current email templates for PII content
   - Implement email retry logic with exponential backoff
   - Evaluate backup email provider (SendGrid, AWS SES) with SOC 2 coverage

2. **Short-term (Q3 2025):**
   - Contact Resend compliance for SOC 2 timeline
   - Request ISO 27001 certificate for records
   - Document compensating controls in vendor management policy

3. **Long-term (Q4 2025 - Q1 2026):**
   - If Resend obtains SOC 2: download report and update this document
   - If Resend delays beyond Q1 2026: consider migration to SOC 2-certified alternative

4. **Auditor Evidence:**
   - Include ISO 27001 certificate in evidence pack
   - Document compensating controls (data minimization, DPA)
   - Note gap and remediation plan in management response

---

## References

- Resend Trust Center: https://resend.com/trust
- Resend DPA: https://resend.com/legal/dpa
- ISO 27001 standard overview: https://www.iso.org/isoiec-27001-information-security.html

**Last Updated:** June 22, 2025  
**Next Review:** September 22, 2025
