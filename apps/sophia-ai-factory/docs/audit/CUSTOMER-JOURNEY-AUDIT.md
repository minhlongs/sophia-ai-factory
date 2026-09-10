# CUSTOMER JOURNEY AUDIT — SOPHIA AI FACTORY
## End-to-End Operational Audit: From "Handover-Ready" to "Customer-Operable"

> **Audit Date:** 2026-09-10  
> **Auditor:** Technical Writer & Documentation Architecture  
> **Target Audience:** Non-Technical CEO Customer, Platform Operator, Engineering Team  
> **Baseline Commit:** `c35840f4` (Zero-Touch Founder Bootstrap Shipped & Verified)  
> **Status:** AUDIT COMPLETE — 17 Touchpoints Traced | 4 Systematic Vulnerabilities Uncovered  
> **Target Output:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/docs/audit/CUSTOMER-JOURNEY-AUDIT.md`

---

## 1. Executive Summary: The Productization Gap

Sophia AI Factory recently attained the technical status of **SUPREME HANDOVER CERTIFIED** (`SUPREME-HANDOVER-CERTIFICATE.md`). All core engine primitives—AES-GCM-256 cryptographic storage, Cloudflare D1 migrations, multi-tenant isolation barriers, zero-touch founder bootstrap hook (`FOUNDER_EMAIL`), and certified provider adapters (fal.ai, HeyGen, ElevenLabs, D-ID, OpenRouter)—are functional in code.

However, an empirical audit of the actual codebase reveals a stark reality:
**"Handover-Ready" (kỹ thuật hoàn thiện) is NOT "Customer-Operable" (khách hàng tự vận hành).**

If an autonomous, non-technical CEO took handover of Sophia today, their journey would break within the first 15 minutes across four critical bottlenecks:
1. **The False Validation Trap:** In `src/tree/components/setup-wizard/steps/index.tsx`, testing API keys for 7 out of 9 providers (fal.ai, OpenRouter, ElevenLabs, D-ID, Anthropic, Muapi, Replicate) executes a fake `setTimeout(300)` that unconditionally returns `valid = true`! Customers enter invalid keys, see green checkmarks, and crash later during video rendering.
2. **The Workspace Vacuum:** When a user registers via Better Auth, no organization (`org_members`) is created. When they navigate to `/dashboard/missions`, the system queries `org_members`, finds 0 workspaces, and displays a dead-end message: "No workspace".
3. **The Missing First-Run UI:** The route `/dashboard/missions/new` does not exist. A non-technical CEO has no visual form to launch their first campaign without running raw terminal cURL commands or reverse-engineering Telegram bot hooks.
4. **The Mock Data & Missing Support Surface:** The settings screen (`settings-page.tsx`) displays hardcoded mock API keys (`sk_live_1234567890abcdef`), and while the backend REST ticketing API (`/api/support/tickets`) is operational, there is zero UI in the web application to submit or view a ticket.

This audit traces all 17 granular touchpoints across the customer lifecycle, diagnosing every point of friction, hidden dependency, and operational hazard to establish the exact remediation requirements for Phases 2 through 10.

---

## 2. Audit Methodology & Evidence Chain

This audit was conducted by reading and executing static code analysis against the actual production codebase:
- **Routing & Middleware:** `src/middleware.ts`, `src/middleware/public-pipeline.ts`, `src/app/[locale]/`
- **Authentication & Authorization:** `src/seed/auth/`, Better Auth server/client hooks, `user_profiles.role`
- **Setup & BYOK:** `src/tree/components/setup-wizard/`, `src/tree/byok/`, `/api/user/byok`, `/api/setup-wizard/`
- **Missions & Generation:** `src/land/creative-mission/`, `src/forest/inngest/functions/agent-mission-executor.ts`
- **Settings & Metering:** `src/components/stitch/screens/settings/settings-page.tsx`, `src/land/billing/`
- **Support & Incident:** `src/app/api/support/tickets/route.ts`, migration `0266_support_tickets.sql`
- **Existing Runbooks:** `docs/runbooks/*` (all 22 runbooks were reviewed for customer usability)

---

## 3. The 17-Touchpoint Customer Journey Trace

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               17-TOUCHPOINT CUSTOMER LIFECYCLE                                    │
│                                                                                                   │
│  [01] LANDING ───────► [02] SIGN UP ────────► [03] BOOTSTRAP ───────► [04] LOGIN                  │
│                                                                           │                       │
│  [08] 1st MISSION ◄─── [07] VALIDATION ◄───── [06] BYOK KEYS ◄────── [05] SETUP WIZARD            │
│       │                                                                                           │
│  [09] GENERATION ────► [10] ARTIFACT ───────► [11] USAGE ──────────► [12] BILLING                 │
│                                                                           │                       │
│  [17] EXIT/EXPORT ◄─── [16] RECOVERY ◄─────── [15] SUPPORT ◄──────── [14] DASHBOARD ◄─── [13] TG │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Touchpoint 01: LANDING & MARKETING ENTRY
* **Component & Route:** `src/app/[locale]/page.tsx`, `src/components/stitch/screens/landing-hero/landing-hero.tsx`
* **Current Behavior:** Marketing homepage rendered with bilingual next-intl support (`/vi` default, `/en`). Hero section presents value proposition, feature grid, pricing preview, and FAQ structured data. Search query redirect (`/?tab=signup` -> `/login?tab=signup`) handles inbound marketing links.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* Locale switcher occasionally drops inbound campaign query parameters (`coupon`, `tier`).
  2. *Technical Dependency:* Next.js 16 server-side translation resolution, Edge SSR caching (`revalidate = 60`).
  3. *Founder Dependency:* Low. Self-contained marketing surface.
  4. *Unclear UI:* Promises "automated video factory" without upfront plain-language disclosure that users must provide their own third-party AI keys (BYOK).
  5. *Missing Error State:* If edge SSR fails during locale bundle compilation, displays generic Next.js 500 without recovery navigation.
  6. *Missing Documentation:* No pre-signup FAQ explaining required API accounts (OpenRouter, ElevenLabs, fal.ai).
  7. *Missing Observability:* Zero client-side tracking for CTA bounce rate or locale toggle frequency.
  8. *Security Risk:* Potential open-redirect vulnerability if query parameter `redirect` is unvalidated before routing.
  9. *Customer Confusion:* Non-technical CEOs expect immediate turnkey generation and feel misled upon encountering BYOK later.
  10. *Operational Risk:* Misaligned expectations increase immediate bounce rate and churn.

---

### Touchpoint 02: CUSTOMER SIGN UP
* **Component & Route:** `src/app/[locale]/register/page.tsx`, `src/components/stitch/screens/auth/register-page.tsx`
* **Current Behavior:** Collects Company Name, Email, Password, Confirm Password, and Terms Agreement. Submits via `authClient.signUp.email()`. Client-side password regex validates length (>=8), uppercase, lowercase, and digit.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **Disjointed Success State:** Upon successful registration, user is NOT automatically signed in or directed to setup. The page displays a static card with "Go to Login" button, forcing the customer to re-enter email and password immediately!
  2. *Technical Dependency:* Better Auth v1.6.2, Cloudflare D1 `"user"` table.
  3. *Founder Dependency:* None.
  4. *Unclear UI:* The success card gives no preview of the 6-step onboarding wizard waiting ahead.
  5. *Missing Error State:* Database lock contention or rate limits emit generic "Registration failed. Please try again."
  6. *Missing Documentation:* No onboarding preview guide linked on registration form.
  7. *Missing Observability:* Drop-off between form view and submit is untracked.
  8. *Security Risk:* No Cloudflare Turnstile or CAPTCHA; vulnerable to automated bot registration spam.
  9. *Customer Confusion:* "Why did I just create an account only to be asked for my credentials again?"
  10. *Operational Risk:* Bot registration spam inflating D1 storage and auth tables.

---

### Touchpoint 03: FOUNDER/OWNER BOOTSTRAP
* **Component & Route:** `src/seed/auth/founder-bootstrap.ts`, Better Auth hook `databaseHooks.user.create.after`
* **Current Behavior:** Triggers synchronously after user creation in Better Auth. Compares `user.email` against comma-separated `FOUNDER_EMAIL` secret. If matched, updates `"user".role = 'admin'`, `user_profiles.role = 'admin'`, `subscriptions.tier = 'MASTER'`, and writes `FOUNDER_BOOTSTRAP` to `admin_audit_log`.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* If the operator enters `FOUNDER_EMAIL` with whitespace or a typo in wrangler secret, bootstrap fails silently; founder registers as an unprivileged BASIC user.
  2. *Technical Dependency:* `process.env.FOUNDER_EMAIL`, Cloudflare D1 batch execution, Better Auth server lifecycle.
  3. *Founder Dependency:* Total dependency on operator setting `FOUNDER_EMAIL` secret prior to signup.
  4. *Unclear UI:* Zero visual confirmation in the app indicating: "Welcome Founder! Master administrative authority activated."
  5. *Missing Error State:* Wrapped in `try/catch` returning `false` (fail-safe). A database batch failure silently drops promotion without alerting the user or operator.
  6. *Missing Documentation:* `docs/runbooks/OPERATOR-BOOTSTRAP.md` is strictly technical for CLI operators; no CEO guide exists.
  7. *Missing Observability:* Logged only via `logger.info`; no Telegram alert or webhook fired to notify the team of bootstrap.
  8. *Security Risk:* If `FOUNDER_EMAIL` is set to an overly broad regex or shared domain, unauthorized elevation occurs.
  9. *Customer Confusion:* Non-founder users never know this exists (desirable), but a founder whose email didn't match is baffled why admin tabs are missing.
  10. *Operational Risk:* Inability to bootstrap forces manual emergency SQL intervention via `RUN-BOOT-001`.

---

### Touchpoint 04: LOGIN & SESSION CREATION
* **Component & Route:** `src/app/[locale]/login/page.tsx`, `src/components/stitch/screens/login/login-form.tsx`
* **Current Behavior:** Form submits to `authClient.signIn.email()`. Issues session cookie `better-auth.session_token`. Redirects to `/${locale}/dashboard` or `redirectTo` parameter.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **Blind Dashboard Routing:** Login unconditionally redirects to `/dashboard` even if the user has NEVER completed the Setup Wizard! New users land in an empty dashboard rather than being routed to `/setup`.
  2. *Technical Dependency:* Better Auth session cookies, D1 session store, CSRF middleware.
  3. *Founder Dependency:* None.
  4. *Unclear UI:* Magic link option is rendered on screen even if platform SMTP/Resend is unconfigured.
  5. *Missing Error State:* Rate limits (HTTP 429) or D1 read timeouts show generic "Network error" banner.
  6. *Missing Documentation:* No "First Time Login" instructions.
  7. *Missing Observability:* Failed login telemetry lacks geographical and user-agent tagging.
  8. *Security Risk:* Magic link spam if rate limiter is bypassed via rotating proxy headers.
  9. *Customer Confusion:* User expects guided setup, but is dumped onto a dashboard with empty metrics.
  10. *Operational Risk:* Session desynchronization between edge regions if D1 cache invalidation lags.

---

### Touchpoint 05: SETUP WIZARD ARCHITECTURE
* **Component & Route:** `src/app/[locale]/setup-wizard/page.tsx`, `src/tree/components/setup-wizard/steps/index.tsx`
* **Current Behavior:** 6 steps: `welcome`, `system_check`, `api_keys`, `provider_credentials`, `review`, `finish`. Split save calls between `/api/user/byok` and `/api/setup-wizard/save-credentials`.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **404 Canonical Route:** Navigating to canonical `/vi/setup` or `/setup` returns 404! Only `/setup-wizard` exists. Furthermore, in `ReviewStep`, clicking "Confirm" runs `handleSave()` and executes `window.location.href = '/dashboard'` on success—skipping `FinishStep` entirely!
  2. *Technical Dependency:* D1 tables `user_api_keys`, `user_provider_credentials`, `user_profiles`.
  3. *Founder Dependency:* High. Operator must configure master encryption secrets on worker.
  4. *Unclear UI:* Artificial split between "API Keys" (Step 3) and "Provider Credentials" (Step 4). A CEO does not understand why fal.ai is an "API Key" while HeyGen is a "Provider".
  5. *Missing Error State:* If saving 7 keys to `/api/user/byok` fails on the 4th key, no transaction rollback exists. Partial keys remain saved; UI shows generic failure.
  6. *Missing Documentation:* No external vendor links explaining where to register accounts for fal.ai, ElevenLabs, or HeyGen.
  7. *Missing Observability:* Step progression events (`wizard_step_viewed`, `wizard_step_completed`) are not tracked.
  8. *Security Risk:* Unsanitized string copy-pastes containing carriage returns or control characters.
  9. *Customer Confusion:* "Why are there two different screens asking me for keys and providers?"
  10. *Operational Risk:* Abandonment at onboarding due to complexity; customers drop off before saving keys.

---

### Touchpoint 06: API KEY & BYOK INPUT
* **Component & Route:** `src/tree/components/setup-wizard/steps/api-keys-step.tsx`, `src/tree/byok/key-format-validators.ts`
* **Current Behavior:** Inputs for OpenRouter, Anthropic, ElevenLabs, D-ID, Muapi, Replicate, fal.ai. Validates format via client regex (`validateProviderKey()`).
* **10-Dimensional Deep Analysis:**
  1. *Friction:* Rigid regex validators reject valid upstream keys if a vendor updates their key format prefix (e.g. ElevenLabs rolling new token structures).
  2. *Technical Dependency:* Web Crypto API, client-side regex tables.
  3. *Founder Dependency:* Code changes required if vendor formats drift.
  4. *Unclear UI:* Error labels display "Invalid key format" without displaying an example of what the expected format looks like (e.g. `sk-or-v1-...`).
  5. *Missing Error State:* No live warning if a key is expired or has depleted account balance.
  6. *Missing Documentation:* No description of minimum required permissions per key (e.g., ElevenLabs TTS vs Admin).
  7. *Missing Observability:* Validation rejections are only tracked locally in React state.
  8. *Security Risk:* Client-side browser autofill or browser extensions accidentally capturing secret key strings.
  9. *Customer Confusion:* Copying keys with invisible trailing spaces leads to confusing validation rejections.
  10. *Operational Risk:* Customers buy subscriptions but cannot input their keys due to regex mismatch.

---

### Touchpoint 07: PROVIDER VALIDATION (THE FALSE VALIDATION TRAP)
* **Component & Route:** `src/tree/components/setup-wizard/steps/index.tsx` (`verifyKey` function, lines 87-139)
* **Current Behavior:**
  - `heygen`: Calls `/api/setup-wizard/test-heygen` (Real ping).
  - `resend`: Calls `/api/setup-wizard/test-resend` (Real ping).
  - **fal.ai, OpenRouter, ElevenLabs, D-ID, Anthropic, Muapi, Replicate:**
    ```typescript
    // No verification endpoint for this service — mark as valid
    await new Promise(resolve => setTimeout(resolve, 300));
    setStatus(prev => ({ ...prev, [keyName]: 'valid' }));
    return true;
    ```
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **CRITICAL INTEGRITY DEFECT:** The system fakes key validation for 7 out of 9 providers! A user can type `FAL_API_KEY = "dummy_garbage_text"`, click Verify, watch a 300ms spinner, and receive a green "VALID" badge!
  2. *Technical Dependency:* Complete absence of server-side lightweight ping routes for fal.ai, OpenRouter, ElevenLabs, and D-ID.
  3. *Founder Dependency:* Extreme. When video generation inevitably crashes, customers blame the platform and contact the founder.
  4. *Unclear UI:* Green checkmark provides 100% false confidence.
  5. *Missing Error State:* Does not catch invalid credentials, expired keys, or zero account balance at the moment of entry.
  6. *Missing Documentation:* No disclaimer that validation was simulated.
  7. *Missing Observability:* Telemetry records fake "valid" status in audit logs.
  8. *Security Risk:* Malformed or malicious strings stored directly into encrypted vault without upstream sanitization check.
  9. *Customer Confusion:* "You told me my key was valid in the setup wizard! Why did my video render fail immediately?"
  10. *Operational Risk:* Severe brand damage and high ticket volume resulting from failed first-run jobs.

---

### Touchpoint 08: FIRST MISSION LAUNCH (THE MISSING SURFACE)
* **Component & Route:** `src/app/[locale]/dashboard/missions/page.tsx`
* **Current Behavior:** Lists missions for workspaces the user belongs to.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **TWO SYSTEMIC BLOCKERS:**
     - **Blocker A (The Workspace Vacuum):** Freshly registered users do NOT have an organization created in `org_members`. The page queries memberships, finds 0, and displays a dead-end message: "No workspace".
     - **Blocker B (Missing New Mission Route):** The canonical creation route `/dashboard/missions/new` DOES NOT EXIST! There is no creation form in the web UI.
  2. *Technical Dependency:* D1 `org_members` table, `createMission` server action.
  3. *Founder Dependency:* Total. The CEO must ask a developer to manually seed a workspace and invoke `createMission` via backend script.
  4. *Unclear UI:* The empty state has no "Create Organization" or "Create Mission" CTA button.
  5. *Missing Error State:* No pre-flight validation checking if the user has active BYOK keys before allowing mission creation.
  6. *Missing Documentation:* No visual guide explaining what a "Mission" or "Campaign" is.
  7. *Missing Observability:* Zero funnel data on users who hit the "No workspace" dead end.
  8. *Security Risk:* Unbounded mission creation without budget limits if initiated via raw API.
  9. *Customer Confusion:* "I registered, I gave my keys, now where do I click to make a video?"
  10. *Operational Risk:* 100% customer drop-off at this step; platform is unusable autonomously.

---

### Touchpoint 09: AUTONOMOUS VIDEO GENERATION PIPELINE
* **Component & Route:** `src/forest/inngest/functions/agent-mission-executor.ts`, `src/forest/ai/provider-factory.ts`
* **Current Behavior:** Inngest function triggers on `agent.mission.started`. Resolves BYOK keys via `buildProviders()`. Orchestrates script -> voice -> visuals -> compositing.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* Multi-step render takes 2 to 5 minutes. The web UI offers no live progress stepper (`[1] SCRIPT -> [2] VOICE -> [3] VISUALS -> [4] COMPOSITING`), leaving the user staring at a static screen.
  2. *Technical Dependency:* Inngest event loop, upstream vendor API latency, Cloudflare outbound HTTP sockets.
  3. *Founder Dependency:* If Inngest workers stall or fail to pick up events, founder must manually restart or inspect Inngest dashboard.
  4. *Unclear UI:* The mission detail page (`/dashboard/missions/[id]`) only displays a 300-character JSON string preview (`outputPreview()`). A non-technical CEO cannot inspect video progress from raw JSON!
  5. *Missing Error State:* If fal.ai triggers a safety/content filter or ElevenLabs runs out of characters, the job terminates with opaque code `AGENT_EXECUTION_FAILED`.
  6. *Missing Documentation:* No customer explanation of AI safety filter triggers or render duration expectations.
  7. *Missing Observability:* Percentage progress (e.g. "60% completed - generating voiceover") is not exposed to client polling.
  8. *Security Risk:* Upstream account bans if prompts violate vendor policies without local sanitization.
  9. *Customer Confusion:* "Is it working, stuck, or broken? What does this JSON text mean?"
  10. *Operational Risk:* Inngest queue backlog during concurrent multi-tenant video generation bursts.

---

### Touchpoint 10: ARTIFACT & MEDIA DELIVERY
* **Component & Route:** Cloudflare R2 bucket (`sophia-ai-factory-opennext-cache` / media bucket), `/dashboard/missions/[id]`
* **Current Behavior:** Rendered MP4s and visual assets are stored in R2. URLs are saved into `output_json`.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* No unified media library or video player in the dashboard. The MP4 link is buried inside JSON attributes.
  2. *Technical Dependency:* Cloudflare R2 presigned URL generation and CORS configuration.
  3. *Founder Dependency:* Low, unless R2 bucket bindings break.
  4. *Unclear UI:* Absence of video player controls (Play, Pause, Scrub, Download 1080p, Copy Shareable Link).
  5. *Missing Error State:* If video renders successfully on HeyGen/fal but R2 upload fails, job is marked "completed" but video file is a broken 404 URL.
  6. *Missing Documentation:* Guidelines on supported aspect ratios (9:16 vertical TikTok/Shorts vs 16:9 YouTube).
  7. *Missing Observability:* Zero analytics on whether the customer successfully previewed or downloaded their finished video.
  8. *Security Risk:* Overly permissive public R2 bucket policies exposing private customer branded assets without auth tokens.
  9. *Customer Confusion:* "Where is the download button for my video file?"
  10. *Operational Risk:* Storage cost accumulation in R2 without lifecycle expiration policies for intermediate scratch frames.

---

### Touchpoint 11: USAGE TRANSPARENCY & METERING
* **Component & Route:** `src/components/stitch/screens/settings/settings-page.tsx`, `src/land/billing/usage-aggregator.ts`
* **Current Behavior:** Billing tables track `performance_events` and `overage_billing_events`.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **MOCK DATA IN SETTINGS:** In `settings-page.tsx`, the API keys section renders hardcoded mock items (`sk_live_1234567890abcdef`), and there is NO `/settings/usage` page where a customer can see real consumption!
  2. *Technical Dependency:* D1 usage aggregation queries, tenant-scoped indexing.
  3. *Founder Dependency:* High. Customers email the founder asking how much credit they have left.
  4. *Unclear UI:* No visual meter or circular gauge showing remaining video minutes or MCU balance.
  5. *Missing Error State:* No 80% or 95% quota warning banners; execution fails abruptly when limit hits.
  6. *Missing Documentation:* No definition of "Model Compute Unit" (MCU) or cost breakdown per provider call.
  7. *Missing Observability:* Lack of real-time burn-rate calculation for high-volume creators.
  8. *Security Risk:* Inadvertent cross-tenant usage aggregation if `WHERE user_id = ?` is omitted in reporting queries.
  9. *Customer Confusion:* "How many more videos can I make this month before I run out of credits?"
  10. *Operational Risk:* Disputed overage charges or sudden production shutdowns mid-campaign.

---

### Touchpoint 12: BILLING, SUBSCRIPTIONS & CHECKOUT
* **Component & Route:** `src/app/[locale]/pricing/page.tsx`, `src/app/[locale]/checkout/page.tsx`, `/api/webhooks/nowpayments`
* **Current Behavior:** Pricing tiers: BASIC ($97), PREMIUM ($297), ENTERPRISE ($997), MASTER ($2997). NOWPayments crypto invoice IDs statically mapped in `tier-configs.ts`. IPN webhook updates tier in `subscriptions` table using atomic D1 locks.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* Crypto checkout confirmation takes 5 to 30 minutes on-chain. Customers are left waiting on a pending screen without clear confirmation of received funds.
  2. *Technical Dependency:* NOWPayments IPN webhook reachability, HMAC-SHA512 verification, D1 atomic locks.
  3. *Founder Dependency:* Extreme during payment glitches. Underpaid crypto transactions leave accounts inactive until founder manually intervenes.
  4. *Unclear UI:* The pricing table does not clearly communicate that crypto (USDT/BTC) is primary and domestic fiat requires separate setup.
  5. *Missing Error State:* Underpaid transactions trigger silent dead-letter queue records (`nowpayments-ipn-underpaid.ts`) without notifying the customer in UI.
  6. *Missing Documentation:* No invoice download, VAT/tax receipt generator, or refund terms in the checkout modal.
  7. *Missing Observability:* Blockchain transaction confirmation progress is not visible to customer.
  8. *Security Risk:* Webhook replay attacks (mitigated by idempotency keys) and IPN spoofing if secret leaks.
  9. *Customer Confusion:* "I sent the USDT 20 minutes ago, why is my plan still showing BASIC?"
  10. *Operational Risk:* Customer disputes and delayed billing activation harming customer retention.

---

### Touchpoint 13: TELEGRAM BOT INTEGRATION (@Sophia_Bbot)
* **Component & Route:** `src/tree/telegram/`, `src/app/actions/generate-telegram-pairing-token.ts`, `/api/webhooks/telegram`
* **Current Behavior:** Telegram bot handles `/start`, `/campaign`, `/status`, `/results`, `/ticket`. Pairing uses single-use 32-character tokens from `telegram_pairing_tokens`.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **Disconnected Pairing Flow:** The pairing token action exists in code, but there is NO visible "Pair Telegram" card or QR code on the main dashboard or settings! It is only accessible via the hidden `/welcome/[token]` route.
  2. *Technical Dependency:* Telegram Bot API, Cloudflare Worker webhook secret header.
  3. *Founder Dependency:* If the webhook secret becomes desynchronized, founder must invoke Telegram API manually.
  4. *Unclear UI:* If an unpaired user sends `/campaign` to the bot, it returns an unhelpful "Unauthorized" text without a direct pairing link.
  5. *Missing Error State:* If Telegram webhook times out (>5s), Cloudflare Worker drops execution without user feedback.
  6. *Missing Documentation:* No cheatsheet of available Telegram bot commands in the web portal.
  7. *Missing Observability:* Bot command usage and failed pairing attempts are not tracked in dashboard metrics.
  8. *Security Risk:* Pairing token brute-forcing if token entropy is low or expiration window is too wide (mitigated by 1h TTL).
  9. *Customer Confusion:* "How do I get the bot to recognize my account?"
  10. *Operational Risk:* Telegram API rate limiting causing dropped webhook notifications during viral campaign bursts.

---

### Touchpoint 14: CEO DASHBOARD & OPERATIONAL REALITY
* **Component & Route:** `src/app/[locale]/dashboard/page.tsx`, `src/components/stitch/screens/dashboard/dashboard-page.tsx`
* **Current Behavior:** Displays 4 KPI cards (Total Campaigns, Active Campaigns, Videos Generated, Success Rate), Top Affiliates list, and Recent Transactions table.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **MOCK AFFILIATE LEAK:** When initial data has no affiliates, `dashboard-page.tsx` (lines 52-85) falls back to hardcoded mock names: `Sarah Jenkins ($1,200)`, `Mark Thompson ($940)`, `Lydia Wells ($600)`. A CEO sees strange names and thinks their account is compromised!
  2. *Technical Dependency:* D1 database aggregations (`fetchCurrentUserDashboard`).
  3. *Founder Dependency:* Low, but customer confusion creates immediate support inquiries.
  4. *Unclear UI:* Mixture of real zero metrics with synthetic fake affiliate sales data creates severe confusion.
  5. *Missing Error State:* If backend aggregation fails, renders fallback cards with 0% without explaining the connection issue.
  6. *Missing Documentation:* No onboarding tooltips explaining how affiliate commissions or campaign tracking are calculated.
  7. *Missing Observability:* Lack of telemetry tracking which dashboard tabs the CEO engages with.
  8. *Security Risk:* Ensuring multi-tenant scoping so real transaction tables never leak cross-tenant rows.
  9. *Customer Confusion:* "Who is Sarah Jenkins and why is she making sales in my company dashboard?"
  10. *Operational Risk:* Misinterpretation of synthetic mock data leading to false business assumptions.

---

### Touchpoint 15: CUSTOMER SUPPORT & TICKETING
* **Component & Route:** `src/app/api/support/tickets/route.ts`, migration `0266_support_tickets.sql`
* **Current Behavior:** Backend REST API exists (`POST /api/support/tickets` and `GET /api/support/tickets`). Stores tickets in `support_tickets` table with priority (`low`, `normal`, `high`, `urgent`).
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **TOTAL UI ABSENCE:** There is ZERO frontend UI in the application to submit or view support tickets! The REST API exists, but no button, modal, or form is mounted anywhere in the web app!
  2. *Technical Dependency:* D1 database `support_tickets` table.
  3. *Founder Dependency:* **100% TOTAL DEPENDENCY.** Because there is no in-app ticketing interface, customers must hunt down the founder's personal Telegram, email, or WhatsApp to report issues.
  4. *Unclear UI:* Non-existent UI.
  5. *Missing Error State:* No automated diagnostic bundle (browser version, tenant ID, active provider status, recent error codes) attached to support inquiries.
  6. *Missing Documentation:* No in-app knowledge base or searchable FAQ.
  7. *Missing Observability:* Ticket resolution time, SLA adherence, and customer satisfaction are untracked.
  8. *Security Risk:* Customers post raw API keys and passwords in unencrypted plain text across external chat apps to get help.
  9. *Customer Confusion:* "Where is customer support? How do I report a problem?"
  10. *Operational Risk:* Founder becomes the sole bottleneck for all operational support, destroying executive focus.

---

### Touchpoint 16: INCIDENT RECOVERY & TROUBLESHOOTING
* **Component & Route:** `docs/runbooks/*`, `src/app/api/cron/mission-reaper`
* **Current Behavior:** When an upstream provider or job fails, status flips to `failed` with raw error message in D1.
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **JARGON & LACK OF SELF-HEALING:** When a render fails, the CEO is presented with raw error strings (`PROVIDER_RATE_LIMIT`, `ETIMEDOUT`). There is no structured "Incident Card" explaining what went wrong and how to fix it.
  2. *Technical Dependency:* Upstream vendor API status, Cloudflare worker logs.
  3. *Founder Dependency:* High. Customers cannot diagnose rate limits or credit depletion without operator help.
  4. *Unclear UI:* Error alerts look like software crashes rather than actionable provider notices.
  5. *Missing Error State:* No 4-zone incident resolution framework:
     - 📌 *What Happened* (Plain English)
     - 🛠️ *What You Can Do* (Action step)
     - 🔄 *Try Again* (1-click idempotent retry)
     - 💬 *Contact Support* (Prefilled diagnostic ticket)
  6. *Missing Documentation:* All existing runbooks (`docs/runbooks/*`) require CLI access (`wrangler`, `curl`, `jq`); zero customer manuals exist.
  7. *Missing Observability:* Customer-facing System Health Center (`/settings/system-health`) is completely missing.
  8. *Security Risk:* Frustrated customers repeatedly rotating and pasting keys, increasing risk of key leakage.
  9. *Customer Confusion:* "Did the system crash? Is my money lost?"
  10. *Operational Risk:* High churn resulting from transient upstream vendor downtime.

---

### Touchpoint 17: ACCOUNT OWNERSHIP, ROLES & CUSTOMER EXIT
* **Component & Route:** `src/components/stitch/screens/settings/settings-page.tsx`, `docs/audit/CUSTOMER-HANDOVER-MATRIX.md`
* **Current Behavior:** Settings page includes dummy buttons for "Delete Account" and "Team".
* **10-Dimensional Deep Analysis:**
  1. *Friction:* **DEAD BUTTONS & NO EXPORT:** The "Delete Account" button in Danger Zone has no `onClick` handler. The "Team" navigation button is an empty stub. There is NO "Export My Data" button anywhere in the platform!
  2. *Technical Dependency:* D1 database cascades, R2 bucket storage lifecycle, cryptographic key destruction.
  3. *Founder Dependency:* Total. Any customer offboarding or data export requires manual SQL exports by the founder.
  4. *Unclear UI:* Interactive buttons that do nothing when clicked.
  5. *Missing Error State:* No two-factor confirmation or grace period for irreversible destructive actions.
  6. *Missing Documentation:* `CUSTOMER-EXIT.md` does not exist; no contractual or technical data portability guarantee.
  7. *Missing Observability:* Zero audit trails for team role delegation or data export events.
  8. *Security Risk:* Orphaned cryptographic keys remaining in `user_api_keys` after customer cancels subscription.
  9. *Customer Confusion:* "If I decide to leave Sophia, do I lose all my video scripts, templates, and analytics?"
  10. *Operational Risk:* Potential legal/GDPR liability if customer requests data deletion and platform cannot prove cryptographic shredding.

---

## 4. Cross-Cutting Systematic Deficiencies (Synthesis Matrix)

| Deficiency Category | Root Cause in Code | Customer Impact | Target Remediation Phase |
|---|---|---|---|
| 🚨 **The False Validation Trap** | `src/tree/components/setup-wizard/steps/index.tsx` uses fake `setTimeout(300)` for 7/9 providers | Customers enter invalid keys, see green checkmark, and fail during video generation | **Phase 2 & Phase 9** (`provider-health-checker.ts`, `/api/setup-wizard/validate-key`) |
| 🚨 **The Workspace Vacuum** | Registration does not seed a default organization row in `org_members` | Users open `/dashboard/missions` and hit a dead-end "No workspace" screen | **Phase 2 & Phase 4** (Auto-seed workspace on onboarding completion) |
| 🚨 **Missing First-Run Route** | `/dashboard/missions/new` does not exist; no mission creation form | Non-technical CEOs cannot launch video campaigns from the web application | **Phase 4** (`/dashboard/missions/new`, `first-run-wizard.tsx`) |
| 🚨 **Mock Data in Settings** | `settings-page.tsx` hardcodes fake keys (`sk_live_123...`) & fake affiliates | Severe loss of trust; customer cannot view real BYOK keys or usage credits | **Phase 5** (`/settings/usage`, live BYOK wire-up) |
| 🚨 **Zero Support UI** | `/api/support/tickets` has no frontend components mounted | Founder is overwhelmed by direct personal messages for basic support issues | **Phase 6** (`/operations`, `support-ticket-modal.tsx`) |
| 🚨 **The CLI Runbook Barrier** | All 22 existing runbooks require bash, wrangler CLI, and curl | Non-technical CEOs cannot troubleshoot or operate the platform independently | **Phase 7** (10 non-technical customer runbooks) |
| 🚨 **No Exit Policy** | No self-service data export or cryptographic shredding protocol | Risk of customer hesitation due to perceived vendor lock-in | **Phase 8** (`CUSTOMER-EXIT.md`, export endpoints) |

---

## 5. Acceptance Criteria for Customer-Operable Certification

To graduate Sophia AI Factory from "Handover-Ready" to **CUSTOMER-OPERABLE PRODUCT**, the following 10 objective criteria must be met:

1. **Canonical Route Resolution:** Both `/vi/setup` and `/en/setup` render the unified 6-step Onboarding Wizard; `/setup-wizard` redirects seamlessly.
2. **True BYOK Verification:** 100% of supported providers (fal.ai, OpenRouter, ElevenLabs, D-ID, HeyGen) are validated against live upstream endpoints via `/api/setup-wizard/validate-key` with fail-closed behavior (0 fake `setTimeout` mocks).
3. **Automated Workspace Provisioning:** Completing onboarding automatically initializes an organization and membership in `org_members` with role `owner`.
4. **Self-Service First Mission:** A non-technical CEO can navigate to `/dashboard/missions/new`, select a starter template (e.g. Viral Shorts), view projected cost in USD/MCU, and launch the mission in under 3 minutes.
5. **Live Video Generation Telemetry:** Mission detail screen displays a real-time progress bar across all 5 milestones (`SCRIPT` -> `VOICE` -> `VISUALS` -> `COMPOSITING` -> `REVIEW`), with direct MP4 video preview and download buttons.
6. **Purged Mock Data:** Zero hardcoded mock keys (`sk_live_...`) or fake affiliates (`Sarah Jenkins`) in production settings and dashboards.
7. **Customer Health Center & Incident UX:** A dedicated `/settings/system-health` surface translating all technical provider errors into actionable 4-zone Incident Cards.
8. **In-App Customer Support Surface:** An integrated support ticketing modal connected to the live `/api/support/tickets` REST backend, complete with automated sanitized diagnostic bundles.
9. **Customer Runbooks Suite:** 10 non-technical, bilingual customer manuals authored in `docs/customer/` with zero CLI prerequisites.
10. **Guaranteed Data Portability & Exit:** Formally ratified `CUSTOMER-EXIT.md` providing self-service one-click export for scripts, video URLs, and analytics, backed by verified cryptographic key destruction.

---

## 6. Conclusion & Transition to Phase 2

The technical foundations of Sophia AI Factory are robust and secure. However, as demonstrated by this comprehensive audit, the productization layer currently prevents autonomous customer operation.

By systematically addressing the findings of this audit across **Phases 2 through 10** of the Productization Sprint, Sophia AI Factory will transform from an engineer-dependent prototype into a truly autonomous, customer-owned, revenue-generating SaaS empire.

*Report certified and delivered: 2026-09-10.*  
*Assigned next step: Phase 2 — Canonical Setup Wizard & BYOK UX (`fullstack-developer`).*
