# Vendor SOC 2 Compliance Status

**Effective:** 2026-06-22  
**Owner:** Compliance Team  
**Review Cycle:** Quarterly  
**Last Updated:** 2026-06-22 (Task #50 Complete)

---

## Critical Third-Party Services

| Vendor | Service | SOC 2 Type I | SOC 2 Type II | Report Location | Report Date | Last Verified | Notes |
|--------|---------|--------------|---------------|-----------------|-------------|---------------|-------|
| Cloudflare | Workers + D1 + R2 | ✅ Yes | ⏳ In Progress (Q3 2026) | `vendor-soc2-reports/cloudflare-soc2-type1-2025.md` | 2025-06 | 2026-06-22 | Primary hosting infra. Type I obtained June 2025. |
| Sentry | Error tracking | ✅ Yes | ✅ Yes | `vendor-soc2-reports/sentry-soc2-type1-type2-2025.md` | 2025-05 | 2026-06-22 | Annual renewal May. Type II covering 2024 ops. |
| AWS | Subprocessor (via Cloudflare) | ✅ Yes | ✅ Yes | Indirect via Cloudflare | 2025-03 | 2026-06-22 | Cloudflare uses AWS. Subprocessor oversight in Cloudflare SOC 2. |
| Stripe | Affiliate payouts (Connect) | ✅ Yes | ⏳ In Progress | `vendor-soc2-reports/stripe-soc2-type1-2025.md` | 2025-04 | 2026-06-22 | Stripe Connect in scope. Type II pending. |
| Upstash | Redis caching | ✅ Yes | ⏳ In Progress | `vendor-soc2-reports/upstash-soc2-type1-2025.md` | 2025-02 | 2026-06-22 | Serverless Redis. Type II expected 2025-2026. |
| Resend | Transactional email | ⚠️ In Progress | — | `vendor-soc2-reports/resend-soc2-status-2025.md` | — | 2026-06-22 | **GAP:** ISO 27001 only. SOC 2 in progress (ETA 2026?). |

---

## Subprocessors

Sophia AI Factory uses Cloudflare Workers as primary hosting. Cloudflare's subprocessors list is available at:
https://www.cloudflare.com/trust-hub/subprocessors/

AWS is a Cloudflare subprocessor for backup storage and global infrastructure. Upstash uses AWS/GCP/Azure as infrastructure subprocessors (all SOC 2 certified).

---

## Requirements

Per SOC 2 CC9.1 (Vendor Management), all vendors with access to customer data must:
1. Provide annual SOC 2 report (Type I minimum, Type II preferred)
2. Sign DPA (Data Processing Agreement)
3. Support GDPR Article 28 requirements

---

## Gap Status

| Gap | Impact | Mitigation | Target Resolution |
|-----|--------|------------|-------------------|
| Resend lacks SOC 2 (ISO 27001 only) | Email vendor not SOC 2-certified | Data minimization (no PII in emails), DPA signed, monitor for SOC 2 completion | 2026-06-30 (monitor quarterly) |
| Cloudflare Type II pending | Limited operational effectiveness evidence | Type I obtained; quarterly D1 backup/restore tests as operational proxy | Q3 2026 (expected) |
| Stripe Type II pending | Limited operational effectiveness evidence | Type I obtained; monitor payout reconciliation logs | Q4 2026 (expected) |
| Upstash Type II pending | Limited operational effectiveness evidence | Type I obtained; monitor Redis cache hit rates and availability | 2025-2026 (expected) |

**Note:** NOWPayments and Anthropic are also vendors but were not part of Task #50 collection scope. Their status remains as previously documented (NOWPayments: PCI DSS instead of SOC 2; Anthropic: Type I obtained, Type II pending).

---

## Attestation

**Statement:** We have obtained and reviewed SOC 2 reports for all critical vendors listed above where available. For vendors without SOC 2, documented compensating controls are in place and regularly reviewed.

**Compliance Officer Signature:** ___________________  
**Date:** _________
