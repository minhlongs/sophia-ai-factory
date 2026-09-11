# ARCHITECTURE TRUTH MAP & DEPENDENCY AUDIT
**Forensic Audit — Lane A (Architecture & Dependencies)**
**Verification Date:** 2026-09-11
**Target SHA:** 6c222630

## PHASE 1: Architecture Truth Map (30 Critical Operations)

Below is the execution flow, boundaries, and failure handling mapped directly from source code.

### 1-5: Authentication, Session & Tenancy
1. **Signup** (`src/seed/auth/better-auth-server.ts:147`)
   - **Entrypoint:** `POST /api/auth/sign-up/email` (Better Auth catch-all)
   - **Auth/Tenant:** Passwords hashed via PBKDF2/scrypt. Tenant auto-created in `user.create.after` hook -> creates `organizations`, `org_members` (owner), `org_balances`, `subscriptions`, `user_profiles`.
   - **Validation:** Name sanitizer `before` hook strips control chars. Password requires 8 chars, uppercase, lowercase, number.
   - **Persistence/Failure:** D1 has no multi-statement transactions; uses `maxRetries=2` sequentially with transient fallback to secondary slug generation. Fail-safe org creation catches errors so user insertion succeeds. 
   - **Ambiguity:** If DB fallback fails completely, user is stranded without an organization, requiring defensive null-handling globally.

2. **Email verification** (`src/seed/auth/better-auth-server.ts:114`)
   - **Entrypoint:** Magic link `/api/auth/magic-link/verify` or POST `/api/auth/sign-up` (bypassed via `autoSignIn: true` for passwords).
   - **Auth/Failure:** Magic link TTL 900s. Passwords signup skips verification gating except for Founder Bootstrap.
   - **External Side Effect:** Sends bilingual email via `tree/email/sender.ts`. Updates `user.emailVerified`.

3. **Login** (`src/seed/auth/better-auth-server.ts:65`)
   - **Entrypoint:** `POST /api/auth/sign-in/email`
   - **Validation:** Password schema. Account lockout hook prevents brute force (`src/seed/auth/account-lockout-hook.ts`).
   - **Failure Boundary:** 401 on bad credentials.

4. **Session creation** (`src/seed/auth/better-auth-server.ts`)
   - **Entrypoint:** Hook `databaseHooks.session.create.before`
   - **Auth Boundary:** Enforces `useSecureCookies: true` in production (prevents non-HTTPS cookies behind Cloudflare proxy). 
   - **Authz Boundary:** Pre-session MFA check (`requireMfaIfEnabled(session.userId)`).
   - **Persistence:** Inserts D1 `session` and issues 7-day cookie TTL.

5. **Tenant/workspace resolution** (`src/seed/auth/resolve-org-id.ts:21`)
   - **Entrypoint:** `resolveOrgId(userId)`
   - **Tenant Boundary:** `SELECT org_id FROM org_members WHERE user_id=? LIMIT 1`.
   - **Failure Boundary:** Returns `null` on missing binding or error (graceful degradation).
   - **Ambiguity:** Solo-company assumption. If a user is in multiple orgs, `LIMIT 1` without `ORDER BY` is non-deterministic.

### 6-10: BYOK Security & Setup Wizard
6. **Setup wizard** (`src/app/api/setup-wizard/save-credentials/route.ts`)
   - **Entrypoint:** `POST /api/setup-wizard/save-credentials`
   - **Auth/Tenant:** `getCurrentUser()`. Tied strictly to `user.id`.
   - **Validation:** Zod `saveCredentialsSchema` validates API key patterns.
   - **Persistence:** Uses `user_provider_credentials` (Not `user_api_keys`!).

7. **BYOK save** (`src/tree/byok/user-api-key-store.ts:32`)
   - **Entrypoint:** `setUserApiKey(userId, provider, plainKey)`
   - **Idempotency/Transaction:** Atomic UPSERT `INSERT ... ON CONFLICT(user_id, provider) DO UPDATE`.
   - **Persistence:** Encrypts in memory (AES-GCM-256) and stores ciphertext in `user_api_keys.encrypted_key`. Plaintext never leaks.

8. **BYOK decrypt** (`src/tree/byok/user-api-key-store.ts:71`)
   - **Entrypoint:** `getUserApiKey(userId, provider)`
   - **Failure Boundary:** Fails gracefully (returns `null`) on D1 error, bad auth-tag (tampering), or missing master key.
   - **Ambiguity:** Silent fallback to environment keys hides credential corruption from end users.

9. **BYOK provider resolution** (`src/tree/byok/resolve-user-api-key.ts:24`)
   - **Entrypoint:** `resolveUserApiKey`
   - **Auth/Tenant:** Takes `isByokEnabled()` into account. Returns `envFallback` if BYOK disabled or user missing.

10. **Provider health validation** (`src/tree/byok/provider-health-checker.ts:49`)
    - **Entrypoint:** `resolveProviderHealthStatus(...)`
    - **Validation:** 7-state safety machine mapping (`ACTIVE`, `INVALID`, `PROVIDER_UNAVAILABLE`, etc.).
    - **Failure Boundary:** Network timeouts map to `PROVIDER_UNAVAILABLE` rather than `INVALID` to prevent "False Validation Trap".

### 11-17: Mission & Artifact Orchestration
11. **Mission creation** (`src/land/creative-mission/actions.ts:112`)
    - **Entrypoint:** `createMission(data)` (Server Action)
    - **Auth/Tenant:** Returns `NOT_AUTHENTICATED`. Checks IDOR via `SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?`.
    - **External Side Effect:** Non-fatal emit `mission.created` metric telemetry.
    - **Persistence:** Inserts to `creative_missions` (status `draft`).

12. **Mission authorization** (`src/land/creative-mission/actions.ts:238`)
    - **Entrypoint:** `updateMissionStatus`, `getMission`
    - **Authz Boundary:** Verifies ownership (`mission.creator_id === user.id`) OR admin override `role IN ('admin', 'owner')`.

13. **Mission preflight** (`src/forest/mission/preflight-check.ts:46`)
    - **Entrypoint:** `runMissionPreflightCheck(options)`
    - **Architecture:** 7 fail-closed gates (auth, ownership, entitlement, credential, capability, storage, queue).
    - **Validation:** Returns `MissionPreflightResult.passed = false` if any gate fails.

14. **Provider invocation** (`src/tree/agent-protocol/agent-executor.ts`)
    - **Entrypoint:** `executeAgent(definition, context, providerRegistry)`
    - **Boundary:** Fails closed on 401/403 (Circuit breaker `AUTH_FAILURE`).

15. **Mission result persistence** (`src/forest/inngest/functions/agent-mission-executor.ts:157`)
    - **Entrypoint:** `updateAgentRun(patch)` and `recordSpend(missionId, cost)`
    - **State Transition:** Mission status never self-completes; it advances to `'review'` via `advanceMissionToReview`.
    - **Failure Boundary:** `recordSpend` failure is caught and logged, preserving the mission result. Spend drops rely on reconciliation cron.

16. **Artifact persistence** (`src/forest/pipeline/checkpoint-service.ts:95`)
    - **Entrypoint:** `CheckpointService.writeCheckpoint`
    - **Persistence:** Assets to R2 (`NEXT_INC_CACHE_R2_BUCKET`), JSON to `video_checkpoints` D1 table.
    - **Validation:** Validated against Zod artifact schema before D1 write.

17. **Gallery retrieval** (`src/app/api/videos/route.ts:18`)
    - **Entrypoint:** `GET /api/videos`
    - **Auth Boundary:** Token or cookie (`getCurrentUserOrOpenclawBearer`).
    - **URL Resolution:** Translates `r2_key` to strict CDN base URL to avoid HeyGen signed link expiry.

### 18-22: Metering, Quota, Billing
18. **Usage metering** (`src/tree/usage-metering/tracker.ts:55`)
    - **Entrypoint:** `trackUsage(event)`
    - **Architecture:** Fast-path KV buffer -> periodic batch flush to D1 `usage_logs`.
    - **Failure Boundary:** In-memory circuit breaker overrides KV failure to keep user path unblocked.

19. **Quota enforcement** (`src/forest/quota/quota-checker-kv-cache.ts`)
    - **Entrypoint:** `checkTierQuota` / `enforceTierQuota`
    - **Architecture:** KV cache layer with 5-minute TTL to reduce D1 pressure on heavy API read routes.
    - **Failure Boundary:** Fail-closed on missing quota, logs `QUOTA_EXCEEDED` tracking overages to `overage_events`.

20. **Billing** (`src/land/billing/actions/change-tier-action.ts`)
    - **Entrypoint:** Server action tier upgrades.
    - **Validation Boundary:** Enum `BASIC | PREMIUM | ENTERPRISE | MASTER`. Pricing mapped exclusively via `TIER_CONFIGS`.

21. **Subscription activation** (`src/land/billing/nowpayments-ipn-handlers.ts:45`)
    - **Entrypoint:** `handleSubscriptionPayment(payment)`
    - **Idempotency:** Atomic lock on `billing_events` using `INSERT ... ON CONFLICT DO NOTHING`. Drops duplicates silently.
    - **Side Effect:** Downgrades or upgrades `user_profiles.subscription_tier`. Invalidates Quota KV cache.

22. **Payment webhook** (`src/app/api/webhooks/nowpayments/route.ts:87`)
    - **Entrypoint:** `POST /api/webhooks/nowpayments`
    - **Security:** HMAC-SHA512 verification on `x-nowpayments-sig`. Max body size 64KB restriction.
    - **Failure Recovery:** If D1 fails, writes raw payload to `nowpayments-dead-letter/` R2 bucket.

### 23-30: Platform Safety & Administration
23. **Diagnostic export** (`src/app/api/account/export/route.ts:12`)
    - **Entrypoint:** `GET` / `POST /api/account/export`
    - **Boundary:** Dumps 10 tenant-scoped tables, scrubs keys/passwords, inserts `usage_logs` audit entry.

24. **Customer deletion** (`src/app/api/account/delete/request/route.ts`)
    - **Entrypoint:** `POST /api/account/delete/request` -> `GET /api/account/delete/confirm`
    - **Boundary:** 7-day cooldown applied to `deletion_scheduled_at`. Authenticated requested + crypto token confirmation.

25. **Tenant deletion** (`src/forest/inngest/functions/account-delete-finalize-cron.ts:30`)
    - **Entrypoint:** `account-delete-finalize-cron` (Hourly Inngest)
    - **Transaction:** Non-atomic cascading delete of API keys, R2 assets, campaigns, orgs, sessions, user rows.

26. **Admin access** (`src/seed/auth/require-admin.ts:1`)
    - **Entrypoint:** `requireAdminWithRecentAuth(request)`
    - **Boundary:** Step-up 5-minute `admin_challenge_token` cookie required for destructive mutations. Role derived from DB or cookie.

27. **Founder bootstrap** (`src/seed/auth/founder-bootstrap.ts:33`)
    - **Entrypoint:** `bootstrapFounderIfConfigured(user)`
    - **Safety Mechanism:** Refuses bootstrap if `user.emailVerified` is false. Fail-closed security rule against spoofing via unverified emails.

28. **Telegram integration** (`src/app/api/webhooks/telegram/route.ts:50`)
    - **Entrypoint:** `POST /api/webhooks/telegram`
    - **DLQ:** Dead-letters unprocessed webhooks to R2 `telegram/` namespace if D1 fails. Matches `update_id` for idempotency.

29. **Background retry** (`src/forest/inngest/functions/agent-rollback-cron.ts:20`)
    - **Entrypoint:** `agent-rollback-cron` (every 5 minutes)
    - **Logic:** Exponential backoff evaluated in pure JS (`min(30m, 5m * 2^retries)`). Workspaces map custom retry caps via `mission_type_policies` (defaults to 3). Drops to terminal `cancelled/RETRIES_EXHAUSTED`.

30. **Failure recovery** (`src/seed/security/circuit-breaker.ts:150`)
    - **Entrypoint:** `classifyError(err)`
    - **Boundary:** Stateful breaker. 401/403 triggers `AUTH_FAILURE` immediately bypassing retry cooldowns, forcing human intervention.

---

## PHASE 2: Dependency Direction Audit

Rule: `seed -> tree -> forest -> land`. Foundational primitives (`seed`) never import up. Reusable domain (`tree`) never imports up. Orchestration (`forest`) may call business workflows (`land`), but `land` NEVER calls `forest`.

### Violation 1: Seed importing Tree / Land (P0: Security Evasion)
`seed` files are bypassing the static ESLint checker using dynamic async imports inline:
- `src/seed/auth/better-auth-server.ts:72, 76`: `import('@/tree/crypto/password-hash')` (seed -> tree)
- `src/seed/auth/better-auth-server.ts:120`: `import('@/tree/email/sender')` (seed -> tree)
- `src/seed/auth/better-auth-server.ts:252`: `import('@/land/mcu/credits-repo')` (seed -> land)
- `src/seed/sop/sop-repo-installations.ts:55`: `void import('@/tree/handover/handover-magic-link')` (seed -> tree)
- `src/seed/ai/script-generator.ts:56`: `import('@/tree/byok/resolve-user-api-key')` (seed -> tree)

*Classification: P0.* `better-auth-server.ts` is secretly orchestrating `land` (credits) and `tree` (password hash, email). Foundational seed logic is contaminated.

### Violation 2: Tree importing Forest / Land (P1: Linter Attrition)
The `eslint.config.mjs` contains **28 hardcoded file exemptions** allowing `tree` to import `forest` and `land`. Example:
- `src/tree/byok/with-timeout.ts` imports from `land/signals` (allowed via MEKONG-EXEMPT)
- `src/tree/sop/solo-orchestrator.ts` imports from `land/openclaw`

*Classification: P1.* The architecture rule is active but Swiss-cheesed by historical exemption lists extending over 200 lines.

### Violation 3: Land importing Forest (P0: Circular Dependency)
Despite definitions that `forest` orchestrates `land`, `land` is inappropriately importing `forest` functions:
- `src/land/creative-mission/actions.ts:26`: `import { runMissionPreflightCheck } from '@/forest/mission/preflight-check';`
- `src/land/openclaw-telegram/openclaw-bridge-tools.ts:9`: `import { schedulePublish } from '@/forest/publishing/schedule-publish';`

*Classification: P0.* This violates the single permitted direction (Forest->Land) defined in `cross-layer-orchestration.md`.

### Violation 4: Direct DB Access in UI Boundaries (P3: Coupling)
Client components are clean (no `getD1` or `createServerClient` in `'use client'` files).
However, rendering Server Components touch D1 directly:
- `src/app/creator/page.tsx:252`: `const db = await getD1();`
*Classification: P3.* Acceptable in Next.js Server Components, but violates strict separation of concerns from UI layout layer.

### Violation 5: Duplicated Auth & Session Logic (P1: Ambiguity Risk)
Four divergent helper patterns exist side-by-side to perform the exact same task (resolve the caller):
1. `getCurrentUser()` in `src/seed/auth/better-auth-session.ts`
2. `getCurrentUserOrOpenclawBearer()` in `src/seed/auth/openclaw-token.ts`
3. `getCurrentUserOrOpenClaw()` in `src/seed/auth/get-current-user-or-openclaw.ts`
4. `getSessionFromRequest()` in `src/middleware/auth.ts`
*Classification: P1.* Subtly differing response shapes and edge-case behaviors (Bearer fallback prioritization).

### Violation 6: Duplicated Tier Resolution (P0: Billing Confusion)
The application has dual sources of truth for defining a user's subscription tier:
- `src/seed/db/get-user-tier.ts: getUserTier` (Called 23 times). Resolves strictly from DB `user_profiles` or `subscriptions`.
- `src/seed/db/resolve-user-tier.ts: resolveUserTier` (Called 53 times). Resolves by calculating the MAX between subscription tier AND dynamically summing clickbank affiliate commissions (`affiliate_conversions` table mapped to BASIC/PREMIUM/ENTERPRISE/MASTER).
*Classification: P0.* Two identical enum outputs derived from drastically different business logic causing non-deterministic quota outcomes if a developer calls the wrong one.

---

## Summary of Dependency Violations

| Violation | Severity | Affected Components | Description / Impact |
|-----------|----------|---------------------|----------------------|
| Dynamic Import Evasion | P0 | `seed/auth/better-auth-server.ts` | Foundational auth imports `land/mcu/credits-repo` and `tree/*` dynamically, bypassing static linter checks |
| Land -> Forest Upward Inversion | P0 | `land/creative-mission/actions.ts`, `land/openclaw-telegram/openclaw-bridge-tools.ts` | Business workflow actions directly import Forest orchestrators, causing circular dependencies |
| Dual Billing Tier Authority | P0 | `seed/db/get-user-tier.ts` vs `seed/db/resolve-user-tier.ts` | Divergent tier calculation logic (raw subscription vs affiliate commission aggregation) causing inconsistent quota states |
| Hardcoded ESLint Exemptions | P1 | `eslint.config.mjs` | 28 file exemptions allowing `tree -> forest/land` cross-layer coupling |
| Identity Resolver Fragmentation | P1 | `seed/auth/*`, `middleware/auth.ts` | 4 different caller-resolution functions with subtle differences in Bearer token fallback |
| Direct D1 Queries in Server Components | P3 | `src/app/creator/page.tsx` | Layout component directly querying D1 database via `getD1()` |

---
## FINAL VERDICT: ARCHITECTURE: RED

The architecture rule `seed -> tree -> forest -> land` is actively broken via lazy dynamic `import()` evasion in the `seed` layer and strict static `import` violations from `land -> forest`. Furthermore, dual authorities exist for Authentication Context and Billing Tiers (2+ resolvers each).
 
