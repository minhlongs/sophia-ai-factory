# Documentation Integrity Critic Findings

## Review Summary

**Verdict**: REQUEST_CHANGES

## Challenge Summary (Adversarial Review)

**Overall risk assessment**: HIGH

---

## 1. Challenge & Stress-Test of Architectural Assumptions

### 1.1. Challenge: The Supabase Dependency is NOT Dead (High Severity)
* **Assumption challenged**: That Supabase has been completely replaced by D1 SQLite and remains "only as remnants" (`SUMMARY.md` and `STRUCTURAL_MAP.md`).
* **Evidence**: The RaaS licensing validator (`src/seed/security/jwt-validator.ts` and `jwt-validator-jwks.ts`) decodes and verifies client license JWTs against a Supabase JWKS endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/jwks` expecting `audience: ['authenticated', 'supabase']`.
* **Attack Scenario**: If the external Supabase project (configured via `NEXT_PUBLIC_SUPABASE_URL`) is deleted, shut down, or has its JWKS keys rotated/removed under the assumption that "Supabase is deprecated in Sophia", the entire licensing layer will fail immediately. It will reject all valid tenant requests, crashing RaaS operations.
* **Blast Radius**: CRITICAL. It disables the API for all paying tenants, blocking all client integrations.
* **Mitigation**: Update the documentation to make it explicitly clear that while the *local user database* is on D1, the *RaaS licensing layer* still depends on an external Supabase instance for JWKS key signature verification.

### 1.2. Challenge: Inngest CPU Execution Limits on Cloudflare Workers Page Isolates (Medium Severity)
* **Assumption challenged**: That Inngest background workflows can run long-running or resource-intensive tasks reliably under the Cloudflare Workers Pages runtime.
* **Evidence**: Sophia AI Factory deploys to Cloudflare Pages via OpenNext (`wrangler.toml` and `wrangler.jsonc`). Under Cloudflare's serverless model, each worker invocation has a strict 30-second CPU time execution limit. Inngest executes jobs via sequential HTTP POST endpoints (`/api/inngest`), split by `step.run` calls.
* **Attack Scenario**: While step execution splits invocations, any single step that makes a slow external API request (e.g. video rendering triggers or ElevenLabs TTS generation) or performs heavy computation (e.g. data processing) that exceeds the CPU threshold will cause the worker to be killed immediately by Cloudflare, resulting in broken/halted background jobs.
* **Blast Radius**: HIGH. Background workflows (like affiliate scouting and multi-step campaign generations) could hang indefinitely.
* **Mitigation**: Offload heavy computations to external sidecars (like Fly.io FastAPI rendering servers) and keep Inngest steps extremely lightweight, acting purely as orchestrators.

### 1.3. Challenge: Circuit Breaker Failure Mode & Real Credit Deduction (High Severity)
* **Assumption challenged**: That the circuit breaker wrapper in `composer-ffmpeg.ts` safely degrades video composition failures by returning a base64 stub MP4.
* **Evidence**: The video composer wrapper (`apps/sophia-ai-factory/src/lib/video/composer-ffmpeg.ts`) catches sidecar timeouts or failures and returns a placeholder video. However, the calling orchestration layers treat this as a successful completion, update the database to `completed` status, and charge the user's MCU organization balance.
* **Attack Scenario**: If the FastAPI rendering service is down, a user can generate a campaign, get charged credits, and receive a completely empty/broken video.
* **Blast Radius**: HIGH. Causes user credit loss, dashboard trust issues, and support ticket surges.
* **Mitigation**: If a fallback/stub video is returned, flag it in the database and do NOT deduct credits, or mark the campaign as `degraded` instead of `completed` so the system can run auto-reconciliation and alert support.

---

## 2. Cross-Reference & Code Verification

### 2.1. Environment Variables Verification
Cross-referencing `docs/environment-variables.md` against `.env.example` and the codebase reveals several critical omissions:

1. **`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`** (Required):
   * **Where**: Marked as required in `src/lib/config/environment-config.ts` (lines 14-15) and used in `jwt-validator-jwks.ts` (lines 12-13).
   * **Issue**: Omitted from `environment-variables.md` and `setup.md`. A new developer following the setup guide will suffer a bootstrap crash (`NEXT_PUBLIC_SUPABASE_URL environment variable not set`).
2. **`RESEND_API_KEY` and `RESEND_FROM_EMAIL`** (Required):
   * **Where**: Required by `better-auth-server.ts` (line 116) to send magic links via Resend.
   * **Issue**: Completely omitted from the documentation variables catalog. Magic link auth will fail silently without these configured.
3. **`DID_API_KEY`** (Optional):
   * **Where**: Validated by `cli-setup.js` (lines 118-128) and saved via `/api/setup/save` route.
   * **Issue**: Completely omitted from the documentation variables catalog.
4. **`AIRTABLE_ACCESS_TOKEN` & `AIRTABLE_BASE_ID`** (Optional):
   * **Where**: Validated by `cli-setup.js` and checked in `environment-config.ts`.
   * **Issue**: Omitted from the variables catalog.
5. **`API_ENCRYPTION_KEY`, `API_KEY_SECRET`, `AUDIT_RECEIPT_SECRET`, `AUDIT_HASH_SALT`** (Required):
   * **Where**: Required for RaaS data encryption/hashing.
   * **Issue**: Omitted from the variables catalog.

### 2.2. Better Auth Setup Verification
* Verified that `better-auth-server.ts` correctly uses the Cloudflare D1 database connection (line 68).
* Verified the `user.create.after` database hook (lines 143-196) correctly auto-inserts rows for `organizations`, `org_members`, `org_balances` (50 credits), `subscriptions` (BASIC plan/tier), and `user_profiles` (for analytics and admin gates). This aligns perfectly with the onboarding guide.
* Verified that the edge middleware (`src/middleware.ts`, line 119) checks MFA pending status via `isSessionMfaPending(session.session.id)` and redirects to `/auth/mfa-challenge`.

### 2.3. Inngest Background Jobs Verification
Cross-referenced `route.ts` vs `index.ts` to identify unregistered jobs. The following 15 background functions are exported by `src/forest/inngest/functions/index.ts` but are **not registered** in the serve route `route.ts`:
* `videoScripting`
* `videoTTS`
* `videoVisual`
* `videoCompose`
* `videoUpload`
* `videoPublish` (Deprecated Phase 06 `video_jobs` pipeline, replaced by HeyGen webhooks)
* `urlRevenueVideoHandler` (Deprecated URL-to-Revenue pipeline)
* `videoGenerate` (Wan 2.1 + Fish Speech video generator)
* `batchVideoFanout` (Batch video triggers)
* `repurposeAnalyze` & `repurposeClipGenerate` (Social repurpose flow)
* `analyticsSync` (Analytics sync scheduler)
* `tokenRefreshCron` (Token rotation)
* `thumbnailAbSelector` (A/B testing selector)
* `sopExecute` (SOP execution engine)

---

## 3. Technical Debt Validation
We verified that the items reported in `TECH_DEBT.md` are accurate and map to real code issues:
* **Dead Inngest SOP Executor**: `sopExecute` in `src/forest/sops/sop-executor.ts` (lines 139-369) is indeed unregistered, and the event `sop/execution.requested` is never published or dispatched anywhere in the codebase.
* **Duplicate Migrations**: Verified that identical SQL migration files exist in both `migrations/` (root) and `apps/sophia-ai-factory/migrations/` (sub-app).
* **Stale Polar.sh References**: Verified that `webhookHeaderSchema` in `src/lib/schemas.ts` (lines 24-32) still contains and requires the obsolete `Polar-Signature` header.

---

## 4. Placeholders Scan
* Verified that no placeholders like `"TBD"` or `"todo"` exist in the 12 reviewed files.

---

## 5. Project Unit Tests Execution
* **Method**: Executed `npm run ci:test` inside `apps/sophia-ai-factory`.
* **Result**: Passed. All unit tests ran successfully with 0 failures, verifying the correctness of local-mode implementations, security prompts, D1 repositories, rate-limits, and session gates.
