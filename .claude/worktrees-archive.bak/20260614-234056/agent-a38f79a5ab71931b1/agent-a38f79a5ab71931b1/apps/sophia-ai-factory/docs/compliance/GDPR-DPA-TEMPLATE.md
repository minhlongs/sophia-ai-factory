# GDPR Data Processing Addendum (DPA) Template

**Version**: 1.0 | **Effective**: 2026-06-12 | **Compliance**: GDPR Art. 28(3)

---

## 1. Parties

- **Controller**: [Customer — Media Agency, Inc.]
- **Processor**: Sophia AI Factory (sophia.agencyos.network)

---

## 2. Subject Matter & Duration

- **Subject**: Cloud-hosted SaaS for content production + AI generation
- **Duration**: Term of Master Service Agreement + 30 days post-termination for data return/deletion

---

## 3. Nature & Purpose of Processing

| Activity | Purpose | Lawful Basis |
|----------|---------|--------------|
| User account storage | Service authentication | Contract Art. 6(1)(b) |
| Content asset upload | Service delivery | Contract Art. 6(1)(b) |
| AI generation telemetry | Service improvement | Legitimate interest Art. 6(1)(f) |
| Billing data | Payment processing | Contract Art. 6(1)(b) |
| Support tickets | Customer service | Contract Art. 6(1)(b) |

---

## 4. Types of Personal Data

- Identity: name, email, IP hash
- Account: user_id, org_id, role, tier
- Content: uploaded media, generated assets (may contain personal data per client)
- Billing: NOWPayments tx IDs, PayOS order codes (no card data — PCI-DSS exempt)
- Telemetry: timestamps, feature usage, error logs (hashed)

---

## 5. Categories of Data Subjects

- Controller's employees (org members)
- Controller's end-clients (if Controller uses SaaS to serve consumer data)
- Controller's content subjects (people depicted in uploaded media)

---

## 6. Processor Obligations (Art. 28(3)(a))

Processor shall:

1. Process personal data only on documented instructions from Controller
2. Ensure persons authorized to process data are bound by confidentiality
3. Implement Art. 32 security measures (see Annex A)
4. Engage sub-processors only with prior written approval (see Annex B)
5. Taking into account nature of processing, assist Controller with Art. 32-36 obligations
6. At choice of Controller, delete or return all data after end of services
7. Make available all information necessary to demonstrate compliance
8. Allow audits, including inspections, by Controller or auditor mandated by Controller

---

## 7. Sub-Processors (Art. 28(4))

| Sub-processor | Purpose | Location | Approval Status |
|---------------|---------|----------|-----------------|
| Cloudflare, Inc. | D1 database, R2 storage, Workers hosting | US/EU | Pre-approved |
| Stripe Payments | Payment processing | US/EU | Pre-approved |
| Better Stack | Logging + monitoring | US | Pre-approved |
| Anthropic, PBC | AI inference (BYOK or platform key) | US | Conditional |
| OpenRouter | Multi-model AI routing | US | Conditional |

**Notification of changes**: Processor shall notify Controller 30 days before adding new sub-processor. Controller may object; if unresolved, Controller may terminate.

---

## 8. Data Subject Rights Assistance (Art. 28(3)(e))

Processor shall assist Controller with:

- Art. 15 Right of access — export endpoint at `/api/compliance/export-data`
- Art. 16 Right to rectification — admin tooling
- Art. 17 Right to erasure — delete endpoint, 30-day soft delete + cert of destruction
- Art. 18 Right to restriction — freeze endpoint
- Art. 20 Right to portability — JSON export

Response SLA: 7 days from Controller's request.

---

## 9. Breach Notification (Art. 33-34)

- Processor notifies Controller within **48 hours** of becoming aware of personal data breach
- Notification includes: nature of breach, categories + approximate number of data subjects, likely consequences, measures taken
- Processor assists with Controller's 72-hour supervisory authority notification

---

## 10. International Transfers

- Primary storage: US (Cloudflare D1)
- EU transfers governed by: EU Standard Contractual Clauses (Commission Decision 2021/914)
- Adequacy decisions relied upon: EU-US Data Privacy Framework (where applicable)

---

## 11. Data Return & Deletion (Art. 28(3)(g))

On termination:

1. Controller has 30 days to export data via `/api/compliance/export-data`
2. After 30 days, Processor deletes all personal data within 7 days
3. Processor provides written certificate of destruction
4. Backup copies purged within 90 days per R2 lifecycle

---

## 12. Audit Rights (Art. 28(3)(h))

- Controller may audit once per calendar year with 30 days notice
- Processor provides SOC 2 Type II report (when available) in lieu of on-site audit
- Cost of audit borne by Controller unless material non-compliance found

---

## Annex A — Technical & Organizational Measures (Art. 32)

| Measure | Status |
|---------|--------|
| Encryption in transit (TLS 1.3) | ✅ Enforced |
| Encryption at rest (D1 + R2 native) | ✅ Cloudflare-managed |
| Pseudonymization (user_id hash for telemetry) | ✅ Implemented |
| Access control (org-scoped + role-based) | ✅ Better Auth |
| Audit logging (append-only, hash-chained) | 🔄 Phase 4 (planned) |
| Backup (daily D1 snapshot to R2, 30-day retention) | ✅ Implemented |
| Incident response plan | ✅ `docs/INCIDENT_RESPONSE.md` |
| Penetration testing | ❌ Not yet (defer SOC 2) |

---

## Annex B — Sub-Processor Approval Workflow

1. Processor publishes new sub-processor at `/legal/sub-processors`
2. Email notification to all Controllers with active DPA
3. 30-day objection window
4. If objection: Processor negotiates alternative OR Controller may terminate without penalty

---

## Signature Block

```
Controller: ___________________________
Name: ___________________________
Title: ___________________________
Date: ___________________________

Processor: Sophia AI Factory
Name: Long Tho (Founder)
Title: CEO
Date: 2026-06-12
```

---

**Source**: GDPR Art. 28(3), IAPP guidance, EDPB Guidelines 07/2020
**Last reviewed**: 2026-06-12
**Next review**: 2026-09-12 (quarterly during first year of operation)
