# Privacy Policy — Sophia AI Factory

**Version**: 1.0 | **Effective**: 2026-06-12
**Compliance**: GDPR (EU 2016/679), CCPA/CPRA (California), UK GDPR

---

## 1. Who We Are

**Controller**: Sophia AI Factory
**Contact**: privacy@sophia.agencyos.network
**DPO**: [To be appointed — interim: Long Tho]

---

## 2. What Personal Data We Collect

| Category | Data | Source |
|----------|------|--------|
| Account | name, email, password hash | Direct from user |
| Identity | org_id, role, tier | Direct from user |
| Billing | payment provider tx IDs, no card data | Stripe, NOWPayments, PayOS |
| Content | uploaded media, generated assets | Direct from user |
| Usage | feature usage, error logs (hashed) | Automatic |
| Device | IP address, user agent | Automatic |
| Cookies | auth session, analytics | Direct from user |

---

## 3. Why We Use It (Lawful Basis)

| Purpose | Lawful Basis | Data |
|---------|--------------|------|
| Service delivery | Contract Art. 6(1)(b) | Account, content, identity |
| Payment processing | Contract Art. 6(1)(b) | Billing |
| Customer support | Contract Art. 6(1)(b) | Account, usage |
| Security (fraud prevention) | Legitimate interest Art. 6(1)(f) | IP, device |
| Service improvement | Legitimate interest Art. 6(1)(f) | Usage (anonymized) |
| Marketing emails | Consent Art. 6(1)(a) | Email |
| Legal compliance | Legal obligation Art. 6(1)(c) | As required |

---

## 4. How Long We Keep It

| Data | Retention | Reason |
|------|-----------|--------|
| Active account data | Term + 30 days | Service delivery |
| Soft-deleted account | 30 days | Recovery window |
| Hard-deleted account | 0 days after deletion | Right to erasure |
| Backup snapshots (R2) | 30 days | Disaster recovery |
| Anonymized usage analytics | 24 months | Product improvement |
| Billing records | 7 years | Tax law |
| Audit logs | 3 years | Compliance + legal hold |

---

## 5. Who We Share It With

| Recipient | Purpose | Safeguard |
|-----------|---------|-----------|
| Cloudflare, Inc. | Hosting, database, storage | DPA + SCCs |
| Stripe Payments | Payment processing | DPA |
| NOWPayments / PayOS | Crypto / VN payment | DPA |
| Anthropic, PBC | AI inference (BYOK or platform) | DPA + zero-retention mode |
| Better Stack | Logging, monitoring | DPA |
| Courts / regulators | Legal obligation | N/A |

**We never sell personal data. We never share for cross-context behavioral advertising.**

---

## 6. International Transfers

Primary storage: US (Cloudflare D1 + R2). EU transfers governed by:

- EU-US Data Privacy Framework (where recipient certified)
- Standard Contractual Clauses (SCCs) 2021/914
- UK International Data Transfer Agreement

Copy of SCCs available on request.

---

## 7. Your Rights

### GDPR Rights (EU/UK users)

| Right | Action | How to Exercise |
|-------|--------|-----------------|
| Access (Art. 15) | Export your data | `/api/compliance/export-data` |
| Rectification (Art. 16) | Update profile | Settings page |
| Erasure (Art. 17) | Delete account | Settings → Delete Account |
| Restriction (Art. 18) | Pause processing | Email privacy@ |
| Portability (Art. 20) | JSON export | `/api/compliance/export-data` |
| Object (Art. 21) | Opt out of legitimate interest | Email privacy@ |
| Withdraw consent | Unsubscribe | Email footer link |
| Lodge complaint | Contact your supervisory authority | [edpb.europa.eu/about-edpb/about-edpb-members](https://edpb.europa.eu/about-edpb/about-edpb-members) |

### CCPA/CPRA Rights (California users)

| Right | Action |
|-------|--------|
| Know | What's collected, shared, sold (we don't sell) |
| Delete | Account + data deletion |
| Opt-out of sale | N/A (we don't sell) |
| Opt-out of sharing | Global Privacy Control honored |
| Limit use of sensitive PI | N/A (we don't collect sensitive PI) |
| Non-discrimination | No penalty for exercising rights |

**Response time**: 45 days (extendable by 45 days with notice).

---

## 8. Security

We implement Art. 32 measures:

- Encryption in transit (TLS 1.3 enforced)
- Encryption at rest (Cloudflare-managed AES)
- Pseudonymization of telemetry data
- Role-based access control
- Audit logging (append-only, hash-chained — Phase 4)
- Daily backups, 30-day retention
- Incident response plan (`docs/INCIDENT_RESPONSE.md`)

**Breach notification**: Without undue delay, within 48 hours to affected customers.

---

## 9. Children

Service not intended for users under 16 (or local minimum age for consent). We do not knowingly collect data from children. If discovered, delete within 7 days.

---

## 10. Cookies

| Cookie | Purpose | Duration |
|--------|---------|----------|
| Session | Authentication | 30 days |
| CSRF token | Security | Session |
| Analytics (optional) | Usage | 1 year |

Opt out via browser settings or our cookie banner.

---

## 11. AI-Specific Disclosures

Per EU AI Act Article 50:

- AI chat interactions: user notified on first message
- AI-generated images/video/audio: marked with C2PA metadata (machine-readable)
- Deepfake-capable features: mandatory pre-generation disclosure prompt
- Public-interest content: customer-tagged workflow with disclosure requirement

---

## 12. Changes to This Policy

Material changes notified via email 30 days in advance. Continued use after effective date = acceptance.

---

## 13. Contact

**Email**: privacy@sophia.agencyos.network
**Response SLA**: 7 business days
**Postal**: [To be added]

---

**Last reviewed**: 2026-06-12
**Next review**: 2026-09-12 (quarterly during first year)
