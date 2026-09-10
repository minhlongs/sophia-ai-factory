# Forensic Customer Journey Trace — Sophia AI Factory

**Date**: 2026-09-10  
**Scope**: 20 End-to-End Transitions from Anonymous Visitor to Account Deletion  
**Standard**: Real file:line citations, database tables, auth/authz guards, and verified failure modes  

---

## Transition Matrix

| # | Stage Transition | Primary Source File:Line | Route / Protocol | Database Table(s) | Auth & Authz Guard | Provider / Service | Failure State & Recovery |
|---|------------------|--------------------------|------------------|-------------------|--------------------|-------------------|--------------------------|
| 1 | Anonymous → Pricing | `src/forest/components/pricing/pricing-section.tsx:33-130` | `GET /[locale]/pricing` | None (code-defined `UNIFIED_TIERS`) | Public access (`isAuthenticated` boolean flag) | Next.js App Router | Fallback to default tier config |
| 2 | Pricing → Signup | `src/seed/auth/better-auth-server.ts:65-95, 221-274` | `POST /api/auth/sign-up/email` | `user`, `account`, `user_profiles`, `organizations`, `org_members` | Public endpoint, password complexity validator | Better Auth + D1 | 400 validation error (weak password), 409 email collision |
| 3 | Signup → Email Verification | `src/seed/auth/better-auth-server.ts:65-92` | **UNIMPLEMENTED** | `user` (`emailVerified` column defaults to 0) | **NONE** — `requireEmailVerification` missing | None | **SECURITY RISK**: Unverified accounts immediately active |
| 4 | Signup → Login | `src/seed/auth/better-auth-server.ts:67` | `POST /api/auth/sign-in/email` | `session`, `user` | Scrypt password hash verification (`autoSignIn: true`) | Better Auth + D1 | 401 invalid credentials, 429 rate limit |
| 5 | Login → Founder Recognition | `src/seed/auth/founder-bootstrap.ts:28-122` | Internal Hook (`databaseHooks.user.create.after`) | `user`, `user_profiles`, `subscriptions`, `admin_audit_log` | Matches `FOUNDER_EMAIL` env var; **P0 BUG**: does not check `emailVerified` | D1 database | D1 unavailable logs error; non-verified email spoofing vulnerability |
| 6 | Login → Setup Wizard | `src/app/[locale]/setup/page.tsx:1-5`, `src/tree/components/setup-wizard/steps/index.tsx:1-180` | `GET /[locale]/setup` | `user_profiles`, `user_api_keys` | `getCurrentUser()` required | Next.js Client Component | 401 redirect to `/login` |
| 7 | Setup → BYOK Key Entry | `src/tree/components/setup-wizard/steps/api-keys-step.tsx:1-170` | In-Wizard State | Memory state (`config`) | Authenticated session | Client-side validation (`key-format-validators.ts`) | Inline field error on regex/format mismatch |
| 8 | BYOK → Provider Validation | `src/app/api/setup-wizard/validate-key/route.ts:1-75` | `POST /api/setup-wizard/validate-key` | None (outbound probe) | `getCurrentUser()` required | OpenRouter, ElevenLabs, D-ID probe | 400 format, 401 provider rejected, 504 timeout |
| 9 | BYOK → Encrypted Persistence | `src/app/api/user/byok/route.ts:29-118`, `src/tree/byok/user-api-key-store.ts:32-75` | `POST /api/user/byok` | `user_api_keys`, `signals_events` | `getCurrentUser()` required | AES-GCM-256 (`byok-crypto.ts`) | **P0 BUG**: `replicate` rejected by Zod enum (`route.ts:29`) |
| 10 | Provider → Capability Resolution | `src/forest/ai/provider-factory.ts:72-187` | Internal Service | `user_api_keys` | Caller passes `userId` | ProviderRegistry | **P0 BUG**: `byokSupported` array omits `fal-ai` and `replicate` |
| 11 | Setup → Billing | `src/tree/components/setup-wizard/steps/payment-step.tsx:1-120` | In-Wizard Step 3 | `user_profiles` | Authenticated session | NOWPayments / PayOS | Skip allowed (defaults to BASIC tier + 50 MCU credits) |
| 12 | Billing → Subscription | `src/app/api/checkout/route.ts:1-90`, `src/tree/clients/nowpayments-client.ts:50-120` | `POST /api/checkout` | `subscriptions`, `payment_events` | User session; Webhook HMAC `x-nowpayments-sig` | NOWPayments Gateway | Signature mismatch (401), payment expired |
| 13 | Subscription → Entitlement | `src/app/api/webhooks/nowpayments/route.ts:180-250` | `POST /api/webhooks/nowpayments` | `subscriptions`, `user_profiles`, `mcu_transactions` | HMAC verification + Idempotent event check | D1 database | Webhook replayed; tier update skipped if already processed |
| 14 | Dashboard → Mission Creation | `src/land/creative-mission/actions.ts:57-140` | Server Action `createMission` | `creative_missions`, `mission_goals` | `getCurrentUser()` + workspace membership check | D1 database | 400 validation error, quota exhaustion, permission denied |
| 15 | Mission → Inngest Execution | `src/land/creative-mission/actions.ts:140-195`, `src/forest/inngest/functions/agent-mission-executor.ts` | Inngest Event `creative-mission.execution.started` | `creative_missions` (status='IN_PROGRESS'), `execution_runs` | Workspace authorization | Inngest Engine | Event dispatch failure; retries up to 3 times |
| 16 | Inngest → AI Provider | `src/forest/inngest/functions/agent-mission-executor.ts:80-220` | Outbound HTTPS | `provider_call_logs` | BYOK Key / Circuit Breaker gate | fal.ai, OpenRouter, ElevenLabs | 429 rate limit backoff, 401 circuit opens |
| 17 | Provider → Artifact Persistence | `src/land/video/video-render.ts`, `src/seed/storage/r2-client.ts` | Cloudflare R2 API | `ai_prompt_video`, `creative_artifacts` | Worker binding (`env.MEDIA_BUCKET`) | Cloudflare R2 | R2 timeout, metadata write failure |
| 18 | Artifact → Dashboard Display | `src/app/[locale]/dashboard/gallery/page.tsx`, `src/tree/components/video/video-card.tsx` | `GET /[locale]/dashboard/gallery` | `ai_prompt_video`, `creative_missions` | `getCurrentUser()` required (`WHERE user_id = ?`) | Cloudflare R2 CDN | 404 missing asset, expired signed URL |
| 19 | Dashboard → Usage / Cost | `src/tree/usage-metering/tracker.ts`, `src/app/[locale]/dashboard/usage/page.tsx` | `GET /[locale]/dashboard/usage` | `usage_logs`, `mcu_transactions`, `user_profiles` | `getCurrentUser()` required | D1 database | Missing logs return zeroed telemetry |
| 20 | Dashboard → Support & Deletion | `src/components/support/diagnostic-bundle-generator.ts`, `src/land/account/cascade-delete.ts:181-280` | `DELETE /api/account` | Cascades across all 9 tenant tables | `getCurrentUser()` + double confirmation header | D1 + R2 cleanup | Foreign key error or aborted cascade |

---

## Detailed Step Walkthroughs

### 1. Anonymous → Pricing
- **Source**: `src/forest/components/pricing/pricing-section.tsx:33-130`, `src/app/[locale]/pricing/page.tsx:1-40`
- **Route**: `GET /[locale]/pricing`
- **DB Tables**: None. Tier configurations are imported from `src/seed/config/tiers/unified-limits.ts`.
- **Auth**: Public access. Server checks `await getCurrentUser()` in `pricing/page.tsx:16` to set `isAuthenticated` prop.
- **Error States**: If unauthenticated user clicks a paid tier, line 82 redirects to `/${locale}/login?next=${encodeURIComponent(/${locale}/pricing)}`.

### 2. Pricing → Signup
- **Source**: `src/app/api/auth/[...all]/route.ts`, `src/seed/auth/better-auth-server.ts:65-95, 221-274`
- **Route**: `POST /api/auth/sign-up/email`
- **DB Tables**: `user`, `account`, `user_profiles`, `organizations`, `org_members`
- **Auth**: Password complexity enforced at `better-auth-server.ts:80-88` (minimum 8 chars, 1 uppercase, 1 lowercase, 1 digit).
- **Hooks**: `databaseHooks.user.create.after` creates default organization and profile (`BASIC` tier), adds 50 signup MCU credits, and fires `bootstrapFounderIfConfigured(user)`.

### 3. Signup → Email Verification (UNIMPLEMENTED)
- **Source**: `src/seed/auth/better-auth-server.ts:65-92`
- **Status**: **UNIMPLEMENTED**. Better Auth options do not configure `emailAndPassword.requireEmailVerification: true`.
- **Risk**: Any user can sign up with any email address and be immediately logged in via `autoSignIn: true`.

### 4. Signup → Login
- **Source**: `src/seed/auth/better-auth-server.ts:67` (`autoSignIn: true`), `src/tree/crypto/password-hash.ts`
- **Route**: `POST /api/auth/sign-in/email`
- **DB Tables**: `session`, `user`
- **Session**: 7-day expiration (`expiresIn: 7 * 24 * 60 * 60`), cookie cached for 5 minutes (`maxAge: 300`). Cookie configured with `__Secure-` prefix in production.

### 5. Login → Founder/Owner Recognition
- **Source**: `src/seed/auth/founder-bootstrap.ts:28-122`, `src/seed/auth/better-auth-server.ts:260`
- **DB Tables**: `user` (role='admin'), `user_profiles` (role='admin', subscription_tier='MASTER'), `subscriptions` (tier='MASTER', plan='master'), `admin_audit_log`
- **Flaw**: Elevated privileges granted strictly based on matching `FOUNDER_EMAIL` env var without validating `user.emailVerified`.

### 6. Login → Setup Wizard
- **Source**: `src/app/[locale]/setup/page.tsx:1-5`, `src/tree/components/setup-wizard/steps/index.tsx`
- **Route**: `GET /[locale]/setup`
- **State Machine**: 6 steps (0: Welcome, 1: Account, 2: API Keys, 3: Payment, 4: Blueprint, 5: Finish).

### 7. Setup → BYOK Key Entry
- **Source**: `src/tree/components/setup-wizard/steps/api-keys-step.tsx:1-170`, `src/tree/byok/key-format-validators.ts`
- **Validators**: Regex checks for OpenRouter (`sk-or-`), Anthropic (`sk-ant-`), ElevenLabs (32+ char), Replicate (`r8_`), and D-ID (base64 auto-encode).

### 8. BYOK → Provider Validation
- **Source**: `src/app/api/setup-wizard/validate-key/route.ts:1-75`
- **Route**: `POST /api/setup-wizard/validate-key`
- **Execution**: Performs real external API requests to test key validity before user commits to saving.

### 9. BYOK → Encrypted Persistence
- **Source**: `src/app/api/user/byok/route.ts:29-118`, `src/tree/byok/user-api-key-store.ts:32-75`, `src/tree/byok/byok-crypto.ts`
- **Route**: `POST /api/user/byok`
- **DB Tables**: `user_api_keys` (encrypted with AES-GCM-256 via Web Crypto API), `signals_events`
- **P0 Defect**: `PROVIDERS` enum in `route.ts:29` lacks `'replicate'`, causing 400 Bad Request when users attempt to save Replicate keys from wizard.

### 10. Provider → Capability Resolution
- **Source**: `src/forest/ai/provider-factory.ts:72-187` (`buildProviders`, `resolveApiKey`)
- **P0 Defect**: `byokSupported` array at line 159 is hardcoded to `['openrouter', 'anthropic', 'elevenlabs']`. It ignores user-stored keys for `fal-ai` and `replicate`.

### 11. Setup → Billing
- **Source**: `src/tree/components/setup-wizard/steps/payment-step.tsx:1-120`
- **Options**: NOWPayments crypto checkout or PayOS VN banking. Allows skip to continue with free tier (50 MCU signup bonus).

### 12. Billing → Subscription
- **Source**: `src/app/api/checkout/route.ts`, `src/tree/clients/nowpayments-client.ts`, `src/app/api/webhooks/nowpayments/route.ts`
- **Route**: `POST /api/checkout` -> `POST /api/webhooks/nowpayments`
- **DB Tables**: `subscriptions`, `payment_events`
- **Security**: NOWPayments webhook validates HMAC-SHA512 signature in `x-nowpayments-sig` against `NOWPAYMENTS_IPN_SECRET`.

### 13. Subscription → Entitlement
- **Source**: `src/app/api/webhooks/nowpayments/route.ts:180-250`
- **DB Tables**: `subscriptions` (tier updated), `user_profiles` (subscription_tier updated), `mcu_transactions` (allocates MCU allocation).
- **Idempotency**: Event ID `nowpayments_{id}_{status}` checked against `payment_events` table before applying tier changes.

### 14. Dashboard → Mission Creation
- **Source**: `src/land/creative-mission/actions.ts:57-140` (`createMission`)
- **Route**: Server Action `createMission`
- **DB Tables**: `creative_missions`, `mission_goals`
- **Validation**: Zod schema verifies title, objective, constraints, and budget.

### 15. Mission → Inngest Execution
- **Source**: `src/land/creative-mission/actions.ts:140-195` (`startMissionExecution`), `src/forest/inngest/functions/agent-mission-executor.ts`
- **Event**: `creative-mission.execution.started`
- **DB Tables**: `creative_missions` (status set to `IN_PROGRESS`, execution timestamp recorded), `execution_runs`

### 16. Inngest → AI Provider
- **Source**: `src/forest/inngest/functions/agent-mission-executor.ts:80-220`, `src/forest/ai/provider-factory.ts`
- **Providers**: fal.ai (image/video), OpenRouter (LLM script generation), ElevenLabs (audio voiceover).
- **Safety**: Circuit breaker pattern (`shouldAllowRequest`, `recordSuccess`, `recordFailure`) prevents cascading failure.

### 17. Provider → Artifact Persistence
- **Source**: `src/land/video/video-render.ts`, `src/seed/storage/r2-client.ts`, `src/tree/db/ai-prompt-video-repo.ts`
- **Storage**: Cloudflare R2 bucket `sophia-ai-factory-opennext-cache`
- **DB Tables**: `ai_prompt_video`, `creative_artifacts`
- **Pathing**: Isolated per user and mission: `users/{userId}/missions/{missionId}/...`

### 18. Artifact → Dashboard Display
- **Source**: `src/app/[locale]/dashboard/gallery/page.tsx`, `src/tree/components/video/video-card.tsx`
- **Route**: `GET /[locale]/dashboard/gallery`
- **DB Tables**: `ai_prompt_video`, `creative_missions`
- **Authz**: Enforces `WHERE user_id = ?` tenant boundary.

### 19. Dashboard → Usage / Cost
- **Source**: `src/tree/usage-metering/tracker.ts`, `src/app/[locale]/dashboard/usage/page.tsx`
- **Route**: `GET /[locale]/dashboard/usage`
- **DB Tables**: `usage_logs`, `mcu_transactions`, `user_profiles`
- **Metrics**: Tracks MCU consumption, estimated API cost, and remaining quota.

### 20. Dashboard → Support, Diagnostics, Export, Deletion
- **Diagnostics**: `src/components/support/diagnostic-bundle-generator.ts` generates client-side redacted diagnostics JSON without leaking keys or credentials.
- **Export**: `src/app/api/account/export/route.ts` provides full user data export in JSON or CSV.
- **Deletion**: `src/app/api/account/route.ts` executes `cascadeDeleteAccount` across all user tables (`user_api_keys`, `usage_logs`, `creative_missions`, `ai_prompt_video`, `subscriptions`, `user_profiles`, `org_members`, `account`, `user`) and cleans R2 assets.
