# Sophia AI Factory: Architectural Risk & Audit Report

**Date:** 2026-05-30  
**Scope:** Active codebase (`/apps/sophia-ai-factory`)  

---

## 1. BYOK Credentials Storage in D1

### Mechanism
User API keys (OpenRouter, Anthropic, ElevenLabs, D-ID, Muapi) are encrypted immediately upon ingest via the Setup Wizard and stored in the D1 `user_api_keys` table.
- **Cipher:** AES-GCM-256 with a randomized 12-byte IV per key.
- **Key Source:** Cloudflare Worker secret `BYOK_MASTER_KEY` (base64-encoded 32 bytes).
- **Integrity:** `userId` is bound as Associated Authenticated Data (AAD) to prevent key-swap attacks. Decryption is performed on-demand at the edge.

### Risks & Trade-offs
- **Universal Compromise (SPOF):** If `BYOK_MASTER_KEY` is leaked from Cloudflare secrets, all customer keys across the platform can be decrypted.
- **No Master Key Rotation:** No automated mechanism exists to re-encrypt stored credentials if the master key is rotated. A manual rotation would break all active tenant keys unless a complex migration script is run.
- **No SQLite Row-Level Security (RLS):** D1/SQLite lacks native RLS. Tenant isolation is enforced solely via query-time filters (e.g., `org_id` or `user_id`). Development oversights on tables missing `org_id` (like `campaigns` or nullable `signals_events`) present a high risk of cross-tenant key leakage.
- **Missing Mutation Logs:** API key rotations, creations, or deletions lack immutable, tamper-proof audit trails in D1.
- **Resource Sprawl:** No constraint on the count of API keys per organization, enabling malicious tenants to perform database storage exhaustion attacks.

---

## 2. Payment Gateway Webhooks Signature Verification

### Mechanism
- **NOWPayments IPN:** Validates `x-nowpayments-sig` using HMAC-SHA512 computed over sorted JSON keys of the request body (`nowPaymentsCanonicalize`).
- **PayOS:** Validates `x-checksum` using HMAC-SHA256.
- **HeyGen Webhooks:** Utilizes per-tenant signing secrets (`HEYEGEN_SIGNING_SECRET`) and validates `org_id` in token (B2 fix).

### Risks & Trade-offs
- **Timing Leak in Length Comparison:** In `src/lib/webhooks/signature.ts`, the `timingSafeEqual` function immediately returns `false` if input lengths differ. This is not strictly constant-time for varying length inputs.
- **No Replay Window Checking on Inbound:** Unlike outbound webhooks, inbound webhook verification (`verifyInboundWebhook`) lacks a timestamp header validation or skew check. Replay-attack protection is delegated entirely to the D1 `payment_events` table (checking `processed` status).
- **D1 Downtime Vulnerability:** If D1 experiences latency or outage, webhook endpoints return 500 errors. If database transactions fail silently or are bypassed during high load, duplicate payments or missed tier activations can occur due to lack of replay protection outside the database state.
- **Unshipped Cross-Tenant Exploit (HeyGen B2):** The critical fix for the HeyGen webhook cross-tenant video mutation (commit `d68b4d96`) is "un-shipped... in dirty tree". Production remains vulnerable to tenant-spoofed webhook payloads mutating other users' video rows.

---

## 3. Platform-Only Server Observability

### Doctrine
Under the "No-Code / No-Tech Doctrine" (effective 2026-05-15), the operator manages only the platform code and Cloudflare bindings. Operator-managed external components (e.g., cron schedulers, paid centralized log management) are explicitly forbidden.

### Risks & Trade-offs
- **No Automated Snapshots:** The D1 backup endpoint (`/api/cron/d1-backup`) is not registered with any external cron runner. Backups rely on manual operators executing curl scripts or basic R2 30-day lifecycles. This compromises the 24-hour RPO guarantee.
- **Minified Stack Traces in Production:** Sentry is configured, but the upload of source maps (`SENTRY_AUTH_TOKEN`) is optional during deployment. Without it, production error traces are minified, significantly increasing Mean Time to Resolution (MTTR).
- **Observability Circular Dependency:** Sentry is bypassed for agent health; monitoring is stored locally in D1 (`signals_events`, `error_log`) and read via `/api/health/agents`. If D1 degrades or crashes, the monitoring system itself becomes completely blind.
- **No Real-time Alerting:** There is no centralized logging cluster. Wrangler logs (`wrangler tail`) must be read manually. Silent failures, edge session failures (e.g., Better Auth edge fallback under D1 latency), and rate-limit blocks cannot trigger proactive alerts.
- **Trade-off:**
  - *Pros:* Zero external hosting costs, minimal operational overhead, clean security boundary (no third-party credentials shared with operator).
  - *Cons:* Purely reactive incident response (relying on customer complaints) and high operational dependency on Cloudflare edge resilience.
