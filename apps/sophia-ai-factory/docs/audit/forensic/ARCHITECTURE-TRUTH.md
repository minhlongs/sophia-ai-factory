# SOPHIA AI FACTORY — ARCHITECTURE TRUTH & EXECUTION REALITY
**Document Version:** 1.0.0 (Forensic Derived from Code)  
**Date:** 2026-10-07  
**Auditor:** Supreme Codebase Forensic Auditor (Adversarial Zero-Trust)  
**Git HEAD:** `0516dd8c7e68c8c217b048f55ffc9a44c66e9111`  
**Live Edge SHA Parity:** Bit-for-bit verified (`0516dd8c` at `https://sophia.agencyos.network/api/version`)  

---

## 1. Executive Summary & Architecture Topology

Sophia AI Factory is an autonomous AI video generation and revenue-as-a-service (RaaS) engine built on Next.js 16 App Router and deployed directly to Cloudflare Workers via OpenNext.

### Topology Overview
```
[Browser / Telegram Client]
         │
         ▼
[Cloudflare Edge Worker (OpenNext runtime)]
  ├── src/middleware.ts (MFA, CSRF, CSP, Auth Gate, Session Cookie)
  ├── Route Handlers / Server Actions (src/app/, src/land/, src/tree/)
  │      │
  │      ├── Seed Layer (src/seed/ - Primitives, D1 Client, Crypto, Tiers, Better Auth)
  │      ├── Tree Layer (src/tree/ - BYOK Store, Mission Checkpoints, AI Providers)
  │      ├── Forest Layer (src/forest/ - Inngest Workers, Orchestrators, Metering)
  │      └── Land Layer (src/land/ - Billing IPN, Payouts, Affiliates)
  │
  ├── Data & State Persistence
  │      ├── Cloudflare D1 (Primary SQLite Database: `sophia-raas-db`)
  │      ├── Cloudflare R2 (Object Storage: `sophia-ai-factory-opennext-cache`, `BACKUPS_BUCKET`)
  │      └── Cloudflare KV (Ephemeral Quota & Auth Cache)
  │
  └── Background Engine
         ├── Inngest Serverless Event Bus (`/api/inngest`)
         └── External AI Providers (OpenRouter, ElevenLabs, D-ID, HeyGen, fal.ai, Replicate)
```

---

## 2. Forensic Mapping of 30 Critical Customer Operations

Below is the exhaustive forensic trace of all 30 critical customer operations from browser input to external provider, database commit, and response.

| # | Operation | Source File & Entrypoint | Auth & Tenant Boundary | Validation & Preflight | Side Effect & Persistence | Failure / Retry Boundary |
|---|---|---|---|---|---|---|
| **1** | **Signup** | `src/app/api/auth/[...all]/route.ts` via Better Auth | Public route; seeds session cookie upon email + password registration | Schema validation in Better Auth core; email format check | Inserts into `user`, `account`, `session` tables in D1 | Rejects duplicate email; fail-closed |
| **2** | **Email Verification** | `src/app/api/auth/verify-email/route.ts` / Better Auth | Public token-authenticated entrypoint | Token existence and expiry check in D1 | Updates `user.emailVerified = 1` | Invalid token throws HTTP 400 |
| **3** | **Login** | `src/app/api/auth/[...all]/route.ts` / Better Auth | Public route; issues signed cookie session token | Validates bcrypt password hash | Updates `session` in D1 | HTTP 401 on password mismatch |
| **4** | **Session Creation** | `src/seed/auth/better-auth-session.ts` | Resolves cookie via `better-auth` API | Validates session token signature & expiration | Writes session record to D1 | Returns `null` if expired/missing |
| **5** | **Tenant Resolution** | `src/seed/auth/better-auth-session.ts` | Resolves active `organization_id` or falls back to `user.id` | Checks user membership in `org_members` | Reads D1 `org_members` table | Fails closed to personal tenant |
| **6** | **Setup Wizard** | `src/components/setup-wizard/setup-wizard-flow.tsx` | Authenticated session (`getCurrentUser()`) | Step state machine; verifies required provider keys | Updates `user_profiles.setup_completed` in D1 | Prevents advancement on save error |
| **7** | **BYOK Save** | `src/tree/byok/user-api-key-store.ts` | `setUserApiKey(userId, provider, plainKey)` | Provider enum check; key non-empty validation | Encrypts AES-256-GCM; writes to `user_api_keys` | SQL conflict update on existing key |
| **8** | **BYOK Decrypt** | `src/tree/byok/byok-crypto.ts` | `decryptApiKey(packed, userId)` | Validates packed length, IV, version, and AAD | Web Crypto `crypto.subtle.decrypt` | Throws on tamper or key mismatch |
| **9** | **BYOK Provider Resolution** | `src/tree/byok/byok-manager.ts` | User-scoped key retrieval | Checks key validation timestamp & format | Decrypts plaintext key for API request | Returns fallback or error if absent |
| **10** | **Provider Health Validation** | `src/tree/ai-providers/health-validator.ts` | Scoped to customer key or fallback | Checks circuit breaker (`shouldAllowRequest`) | Probe HTTP call to provider `/models` or `/user` | Tripping circuit breaker opens gate |
| **11** | **Mission Creation** | `src/land/missions/actions/create-mission.ts` | Session auth + tenant ownership | Zod payload validation (`CreateMissionSchema`) | Writes `missions` table with status `CREATED` | Transactional D1 row insertion |
| **12** | **Mission Authorization** | `src/tree/mission/mission-auth.ts` | Tenant ID matching `session.tenantId` | IDOR check on mission owner vs caller | Reads `missions.user_id` and `tenant_id` | HTTP 403 / failure on mismatch |
| **13** | **Mission Preflight** | `src/tree/mission/preflight-check.ts` | 7-gate fail-closed preflight checklist | Auth, ownership, quota, BYOK, capability, storage, queue | Validates max cost $\le$ \$5.00 (500 cents) | Aborts execution with Gate error |
| **14** | **Provider Invocation** | `src/forest/mission/multi-track-orchestrator.ts` | Isolated BYOK key injection | Circuit breaker wrapped HTTP client | Invokes OpenRouter / ElevenLabs / Fal.ai | Classifies HTTP errors & status |
| **15** | **Mission Result Persistence** | `src/forest/mission/multi-track-orchestrator.ts` | Tenant-scoped mission ID | OCC CAS `WHERE id = ? AND status = ?` | Updates `missions.status = 'COMPLETED'` | Detects concurrent update conflict |
| **16** | **Artifact Persistence** | `src/tree/mission/artifact-vault.ts` | Scoped to `tenants/${tenantId}/` | Content-type & buffer size verification | Writes media files directly to R2 bucket | Retries R2 upload up to 3 times |
| **17** | **Gallery Retrieval** | `src/land/gallery/actions/get-gallery.ts` | Session tenant ID filtering | Pagination & tag filtering | Reads `artifacts` table `WHERE tenant_id = ?` | Returns empty array if none found |
| **18** | **Usage Metering** | `src/forest/usage-metering/metering-service.ts` | User & organization scoping | Validates MCU cost calculation | Appends to `usage_events` table in D1 | Batched atomic flush |
| **19** | **Quota Enforcement** | `src/forest/quota/quota-enforcer.ts` | Tier allowance + add-on balance check | Checks monthly MCU allotment against usage | Reads KV cache first, falls back to D1 | Rejects mission if over limit |
| **20** | **Billing** | `src/land/billing/services/billing-service.ts` | Scoped to authenticated user | Price lookup in `TIER_CONFIGS` | Generates NOWPayments payment invoice | Rejects invalid tier requests |
| **21** | **Subscription Activation** | `src/land/billing/nowpayments-ipn-finished.ts` | Validated IPN event | Checks HMAC signature & amount paid $\ge$ expected | Updates `user.tier` & `subscriptions` in D1 | Idempotent lock via `payment_events` |
| **22** | **Payment Webhook** | `src/app/api/webhooks/nowpayments/route.ts` | Public webhook; HMAC-SHA512 header | Enforces body $\le$ 64KB & IPN secret check | D1 `payment_events` atomic deduplication | Dead-letter logged to R2 on DB fail |
| **23** | **Diagnostic Export** | `src/tree/audit/diagnostic-bundle.ts` | Admin / Authenticated Owner | Deep secret & PII scrubbing (`scrubPIIDeep`) | Packages redacted logs & config | Zero secret leakage guarantee |
| **24** | **Customer Deletion** | `src/forest/inngest/functions/account-delete-finalize-cron.ts` | Multi-step confirmed deletion | Ownership confirmation token | Cascades deletion across D1 tables & R2 assets | Fail-safe soft-lock before prune |
| **25** | **Tenant Deletion** | `src/seed/db/tenant-prune.ts` | Admin / Master tier caller | Confirmation token & workspace match | Deletes tenant records and isolates keys | Hard foreign key cascade |
| **26** | **Admin Access** | `src/seed/auth/admin-guard.ts` | `user.role === 'admin'` or MASTER tier | Session verification & MFA check | Reads admin views & audit logs | 403 Forbidden on non-admin |
| **27** | **Founder Bootstrap** | `src/seed/auth/founder-bootstrap.ts` | Fail-closed email verification check | Matches `FOUNDER_EMAIL` & `emailVerified` | Elevates user to role `admin`, tier `MASTER` | Refuses unverified email |
| **28** | **Telegram Integration** | `src/app/api/telegram/webhook/route.ts` | Telegram Bot token verification | Chat ID pairing validation (`telegram_paired_chats`) | Dispatches `/campaign`, `/status`, `/results` | Silent 200 on unhandled updates |
| **29** | **Background Retry** | `src/forest/inngest/inngest-retry-policy.ts` | Inngest event execution context | Exponential backoff curve (1s to 60s) | Re-attempts transient failures up to max limit | Routes to DLQ after max attempts |
| **30** | **Failure Recovery** | `src/forest/mission/recovery-manager.ts` | Mission tenant context | Checks for orphaned `RUNNING` missions > 15m | Sets status to `FAILED_RECOVERABLE` & refunds MCU | Prevents double consumption |

---

## 3. Boundary & Invariant Assessment

1. **Authentication Boundary:** Better Auth handles all core password and session operations. Better-auth-session verifies incoming session cookies synchronously against D1.
2. **Tenant Boundary:** Strict tenant scoping enforced via `tenant_id` and `user_id` query filters on all mission, artifact, and API key queries.
3. **Financial Invariance:** Atomic locking via D1 `payment_events` (`INSERT ... ON CONFLICT DO NOTHING`) guarantees payment idempotency.
4. **Cryptographic Protection:** Web Crypto AES-256-GCM with AAD user binding encrypts all customer keys at rest. Zero plaintext keys are ever persisted.
