# Vendor SOC 2 Compliance Status

**Effective:** 2026-06-17  
**Owner:** Compliance Team  
**Review Cycle:** Quarterly

---

## Critical Third-Party Services

| Vendor | Service | SOC 2 Type I | SOC 2 Type II | Report URL | Last Verified | Notes |
|--------|---------|--------------|---------------|------------|---------------|-------|
| Cloudflare | Workers + D1 + R2 | ✅ Yes (2025) | ⏳ In Progress | [Trust Hub](https://www.cloudflare.com/trust-hub/) | 2026-06-01 | Type II expected Q3 2026. Service scope covers all hosting infra. |
| Sentry | Error tracking | ✅ Yes | ✅ Yes | [Compliance Docs](https://sentry.io/trust/) | 2026-05-15 | Annual renewal May. SOC 2 report downloaded to `docs/compliance/vendor-reports/sentry-soc2-2025.pdf` (redacted). |
| OpenAI | LLM API | ✅ Yes | ✅ Yes | [Trust Portal](https://openai.com/trust) | 2026-04-01 | Annual renewal May. Covers API data processing. |
| Anthropic | LLM API | ✅ Yes | ⚠️ Partial | [Compliance](https://www.anthropic.com/compliance) | 2026-03-15 | Type II currently in audit. Expected completion Q4 2026. |
| NOWPayments | Crypto payments | ❌ No SOC 2 | — | — | — | PCI DSS Level 1 certified instead. DPA signed. Compensating control: funds held in multi-sig escrow. |
| Cloudflare R2 Storage | Object storage | ✅ Yes (via Cloudflare) | ⏳ In Progress | Same as Cloudflare | 2026-06-01 | Included in Cloudflare SOC 2 scope. |
| Resend | Transactional email | ⚠️ In Progress | — | — | — | Awaiting SOC 2 certification. Currently ISO 27001 certified. |

---

## Subprocessors

Sophia AI Factory uses Cloudflare Workers as primary hosting. Cloudflare's subprocessors list is available at:
https://www.cloudflare.com/trust-hub/subprocessors/

---

## Requirements

Per SOC 2 CC9.1 (Vendor Management), all vendors with access to customer data must:
1. Provide annual SOC 2 report (Type I minimum, Type II preferred)
2. Sign DPA (Data Processing Agreement)
3. Support GDPR Article 28 requirements

---

## Gap Status

| Gap | Mitigation | Target Resolution |
|-----|------------|-------------------|
| NOWPayments lacks SOC 2 | PCI DSS Level 1 + multi-sig escrow | Monitor for SOC 2; maintain alternative (PayOS backup) |
| Anthropic Type II pending | Type I already obtained | Q4 2026 |
| Cloudflare Type II pending | Type I obtained; Type II in progress | Q3 2026 |

---

## Attestation

**Statement:** We have obtained and reviewed SOC 2 reports for all critical vendors listed above where available. For vendors without SOC 2, documented compensating controls are in place and regularly reviewed.

**Compliance Officer Signature:** ___________________  
**Date:** _________
