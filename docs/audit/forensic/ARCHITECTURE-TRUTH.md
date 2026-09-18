# ARCHITECTURE TRUTH: SOPHIA AI FACTORY (CODE-DERIVED RUNTIME REALITY)

**Target System:** Sophia AI Factory (`apps/sophia-ai-factory`)  
**Production Host:** `https://sophia.agencyos.network`  
**Deployment Infrastructure:** Cloudflare Workers (OpenNext 1.19.11) + Cloudflare D1 + R2 + Inngest  
**Audit Standard:** Code is the authority. Runtime behavior is the second authority. Tests are evidence, not truth.  
**Audit Date:** 2026-09-18  

---

## 1. Top-Level Architectural Invariants & Layer Topology

Sophia AI Factory claims a strict 4-layer unidirectional architecture:
$$\text{seed} \longrightarrow \text{tree} \longrightarrow \text{forest} \longrightarrow \text{land}$$

- **`seed/` (Foundational Primitives):** Base D1 database client (`client.ts`), Web Crypto encryption (`encryption.ts`), Better Auth server runtime (`better-auth-server.ts`), core types, logging primitives. Must have zero dependencies on upper layers.
- **`tree/` (Domain Engines & Repositories):** BYOK credential repositories, AES-GCM-256 AAD encryption, mission state machine (`types.ts`), performance tracking, provider client SDK adapters.
- **`forest/` (Orchestrators & Pipelines):** Inngest background event handlers (`agent-mission-executor.ts`, `agent-rollback-cron.ts`), AI capability factory, publishing dispatchers.
- **`land/` (Applications, UI & Billing Workflows):** Next.js App Router server actions, NOWPayments/PayOS webhook lifecycle handlers, UI screens, customer onboarding wizard.

---

## 2. Comprehensive Trace of Critical Customer Operations

### Flow 1: Signup & Email Verification
- **Entrypoint:** Browser -> `POST /api/auth/sign-up/email` (Next.js route handler -> Better Auth engine).
- **Middleware:** `src/middleware.ts` intercepts, checks route protection, applies rate limiting (`upstash/ratelimit` or fallback).
- **Auth/Session:** Better Auth creates row in D1 `"user"` table (`emailVerified: 0`). Generates verification token.
- **Tenant Resolution:** None yet; personal tenant initialized upon onboarding.
- **Authorization Boundary:** Public endpoint.
- **Validation Boundary:** Better Auth Zod schema (valid email, password length >= 8).
- **Transaction Boundary:** D1 SQL insert into `"user"` and `"account"`.
- **External Side Effect:** Resend API invocation via Inngest `sendVerificationEmail` or direct fetch.
- **Persistence Boundary:** D1 `"user"`, `"verification"` tables.
- **Idempotency:** Unique index on `"user".email`.
- **Failure Boundary:** If email dispatch fails, user account exists but unverified. Resend verification available via UI.

### Flow 2: Founder Bootstrap Gate
- **Entrypoint:** Post-signup hook in Better Auth -> `bootstrapFounderIfConfigured(user)` (`src/seed/auth/founder-bootstrap.ts`).
- **Auth Boundary:** User session created.
- **Fail-Closed Security Check:** Inspects `user.emailVerified` and queries D1 `"user"`. If `emailVerified !== true && emailVerified !== 1`, aborts immediately with `[FounderBootstrap] Refusing to elevate unverified user`.
- **Elevation Boundary:** Updates `"user".role = 'admin'`, `user_profiles.subscription_tier = 'MASTER'`, `subscriptions.plan = 'master'`.
- **Observability:** Writes immutable audit log into `admin_audit_log` with `source: 'FOUNDER_EMAIL_ENV'`.

### Flow 3: Login & Session Creation
- **Entrypoint:** Browser -> `POST /api/auth/sign-in/email` -> Better Auth.
- **Middleware:** Path passthrough.
- **Session Lifecycle:** Generates session cookie `better-auth.session_token` signed with HMAC-SHA256. D1 write to `"session"`.
- **Tenant Resolution:** `resolveOrgId(user.id, db)` queries `org_members` or creates user-scoped default org.
- **Observability:** Session creation logged in D1.

### Flow 4: Setup Wizard & BYOK Storage
- **Entrypoint:** Browser -> `POST /api/user/byok` (`src/app/api/user/byok/route.ts`).
- **Auth Boundary:** `getCurrentUserFromHeaders(request.headers)` (fail-closed 401).
- **Tenant Boundary:** `user.id`.
- **Validation Boundary:** `key-format-validators.ts` validates regex prefix (`sk-ant-`, `r8_`, `key-`, etc.).
- **Crypto Boundary:** `encryptValue(key, userId)` in `src/tree/credentials/encryption.ts` encrypts using AES-GCM-256 with AAD (`additionalData = userId`), binding the ciphertext cryptographically to the tenant.
- **Persistence Boundary:** D1 `user_provider_credentials` upsert with `encrypted_value`, `key_version`.
- **Secret Hygiene:** Raw keys never persisted; zero plaintext keys returned in responses.

### Flow 5: Subscription Checkout (NOWPayments Crypto)
- **Entrypoint:** Browser -> `POST /api/checkout` (`src/app/api/checkout/route.ts`).
- **Auth Boundary:** `getUserId(request)` (401 if unauthenticated).
- **Order Tracking:** Generates `orderId: sophia_${userId}_${Date.now()}`. Writes `pending_orders` row in D1 with `tier`, `period`.
- **Provider Side Effect:** Calls NOWPayments API `createCheckout()` with `order_id`, `price_amount`, `ipn_callback_url`.
- **Response:** Returns `{ url: invoiceUrl, orderId }` for client redirect.

### Flow 6: IPN Webhook & Tier Activation (Anti-Drop Protected)
- **Entrypoint:** NOWPayments Webhook POST -> `POST /api/webhooks/nowpayments` (`src/app/api/webhooks/nowpayments/route.ts`).
- **Auth Boundary:** HMAC-SHA512 verification over payload using `NOWPAYMENTS_IPN_SECRET` (`x-nowpayments-sig` header).
- **Idempotency Lock:** D1 atomic lock: `INSERT INTO payment_events (event_id, event_type, payload, processed) VALUES (...) ON CONFLICT(event_id) DO NOTHING`.
- **Dispatch Routing (`nowpayments-ipn-dispatch.ts`):**
  - Looks up static invoice in `NOWPAYMENTS_TIERS` or `ONE_TIME_SKUS`.
  - **Dynamic Fallback (Fixed):** If `lookup` is null but `ipn.order_id` exists, routes to `handleFinished(ipn)` which queries `pending_orders` by `order_id`.
- **Fulfillment Boundary:** `activateSubscriptionForOrg()` writes to `subscriptions` and `user_profiles` in D1, resetting quota and unlocking tier capabilities.

### Flow 7: Creative Agent Mission Execution
- **Entrypoint:** Server Action `startCreativeMissionAction` -> Inngest event `agent.mission.started`.
- **Preflight Gate:** `runMissionPreflightCheck()` enforces 7 gates:
  1. Capability gate
  2. Provider credential validation (BYOK presence)
  3. MCU Balance > 0
  4. Budget sufficiency
  5. Subscription tier quota
  6. Authorization check
  7. Fail-closed error handling
- **Inngest Function (`agent-mission-executor.ts`):**
  - Wrapped in `step.run('execute-agent')` for memoized provider calls.
  - Decrypts BYOK credentials with tenant AAD.
  - Invokes AI model (OpenRouter / Anthropic).
  - Deducts MCU credits via `deductCredits(userId, mcuAmount)`.
  - Records cost in `creative_missions.spent_cents`.
  - Advances state to `'review'` (never self-completes).
- **Failure Path:** If execution fails, marks run failed, emits `agent.mission.failed`, and invokes `markMissionFailed(missionId)` so mission status in D1 transitions to `'failed'` (preventing infinite spinning).
