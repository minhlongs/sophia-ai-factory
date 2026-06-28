# Security Architecture — Sophia AI Factory

This document describes the security model, encryption mechanisms, session policies, and threat mitigations implemented across the Sophia AI Factory platform.

---

## 1. Threat Model & Asset Protection

| Asset | Sensitivity | Risk Profile | Mitigations |
|---|---|---|---|
| **Customer BYOK keys** | Critical | Database compromise, operator breach, log exposure | Encrypted using AES-256-GCM with a unique IV per key; master key stored in Cloudflare Secrets. |
| **Session Cookies** | Critical | CSRF, Session hijacking, XSS | `httpOnly`, `Secure`, `SameSite=Lax` cookies managed by Better Auth with a 7-day expiration. |
| **Tenant Data** | Critical | Cross-tenant data leaks, SQL injection | org_id query-level scoping, parameterized queries via Drizzle ORM, tenant validation middleware. |
| **Payment webhooks** | High | Request spoofing, transaction replay | HMAC-SHA256 signature verification and constant-time signature comparison. |

---

## 2. Authentication & Session Policies

* **Session Management**: Session cookies are generated upon login and verified on every request using Better Auth v1.6.2. 
* **Password Storage**: Passwords are encrypted using PBKDF2 with SHA-512 and 100,000 iterations (Better Auth standard setup).
* **Multi-Factor Authentication (MFA)**: MFA flows (TOTP and Telegram-based SMS/OTP triggers) are tracked inside dedicated `mfa_*` tables in D1. Nonce validation is enforced on Telegram login JWTs (3-minute expiration, single-use only) to prevent replay.

---

## 3. Data Scoping & Multi-Tenancy

Multi-tenancy is enforced at the query level by mapping records to an `org_id` foreign key.
* **ORM Enforcement**: Drizzle queries must explicitly scope transactions with `eq(table.org_id, orgId)`.
* **Tenant Isolation Middleware**: The `validateTenantIsolation()` middleware intercepts requests, extracts tenant credentials from the session, and verifies permissions before invoking business logic handlers.

---

## 4. Encryption Standards

### Bring Your Own Key (BYOK) Encryption
API credentials provided by users (e.g. OpenRouter, ElevenLabs) are encrypted before storage:
* **Algorithm**: AES-256-GCM.
* **Key Derivation**: Sourced from the `BYOK_MASTER_KEY` environment secret.
* **Salt & IV**: Generated dynamically per credential record. Plaintext keys are never written to disk, database rows, or log files.

---

## 5. Webhook Security

### NOWPayments Webhooks
NOWPayments IPN calls must present a valid `x-nowpayments-sig` header. The signature is validated by generating an HMAC-SHA256 digest of the request body using `NOWPAYMENTS_IPN_SECRET` and comparing the strings in constant time to prevent timing attacks.

### HeyGen Webhooks
HeyGen callback events are signed using a tenant-specific signing key. Webhook payloads validate the tenant's `org_id` boundary prior to modifying video generation job states.

---

## 6. Vulnerability Disclosure & Support

To report security issues, do not open public issues. Send detailed reports to:
* **Contact**: security@agencyos.network
* **Response SLA**: 
  - P0 (RCE / Credential compromise): 24 hours
  - P1 (Auth bypass / Data exposure): 72 hours
  - P2 (XSS / CSRF): 1 week
* **Key Exchange**: Obtain our public PGP key from standard key servers (keys.openpgp.org) using search query `security@agencyos.network`.
