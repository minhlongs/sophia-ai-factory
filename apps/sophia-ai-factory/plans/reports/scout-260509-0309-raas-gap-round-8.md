# Scout Round 8 — RaaS Dashboard GAP Sweep

- **Working dir:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory`
- **Branch/SHA:** `main @ 51bf5c00` (live `/api/version` → `51bf5c00`, deployed 2026-05-09T10:06:41Z) — verified
- **Round:** 8 — fresh un-scouted surfaces (auth, welcome, MCU cron, agent-chat SSE, api-keys UI, branding R2, email i18n)
- **Generated:** 2026-05-09T10:14Z
- **State of dashboard:** Wave-5 features all live; CSP report bypass + tier rate-limit working. **CRITICAL:** subscription→MCU monthly top-up cron silently no-ops because it queries non-existent `user_subscriptions` table (real table is `subscriptions`). Agent-chat SSE charges credits AFTER stream — zero-balance users still get full LLM call. NO dashboard UI exposes the working `/api/v1/api-keys` CRUD endpoints. Magic-link auth email subject EN, body VI hardcoded — cross-language. Welcome flow + token validation + resend + SSE mission stream are clean. R2 branding cleanup absent (logo orphans on overwrite ext-change). Better-Auth user.create hook inserts subscription row without `user_id`/`tier`, FREE100 path saved by org_members fallback. No password-reset / email-verify endpoints at all. Telegram pairing / dunning UI pages are solid.

---

## TOP 8 GAPs

### F-1 · MCU monthly reset cron queries wrong table — never tops up subs · P0 · S
**Loc:** `src/app/api/cron/mcu-monthly-reset/route.ts:67-70`
**Evidence:** Code: `db.from('user_subscriptions').select('id, tier').eq('status','active')`. Schema (migrations `0001`, `0086`, `0087`): real table is `subscriptions`. `grep -rn user_subscriptions` returns ONE hit — the cron itself. Cron is in `wrangler.toml` crons list (`0 0 1 * *`). Result: `activeUsers = []` every month, zero users get monthly MCU reset → revenue users silently exhaust credits → support tickets.
**Fix:** Rename to `subscriptions`, change `select('id, tier')` to `select('user_id, tier')` (id is sub PK not user PK), and `addCredits(user.user_id, ...)`.
**Effort:** S

### F-2 · Agent-chat SSE charges credits AFTER full LLM call · P0 · S
**Loc:** `src/app/api/v1/agent-chat/route.ts:115-130`
**Evidence:** No balance precheck before `fetch(llmRoute.baseUrl + /chat/completions)`. Deduction happens in `formatStream` loop on `event.type === 'done'` then `.catch(() => null)` swallows insufficient-credit failure. Zero-balance / dunning-locked users still consume upstream LLM tokens (real $) and get full reply. Also no rate limit wrapper.
**Fix:** Call `getBalance(user.id)` before fetch; reject 402 if `< 1`. Tee deductCredits return → if false, abort stream early. Add rate-limit wrapper for tier.
**Effort:** S

### F-3 · No dashboard UI for /api/v1/api-keys CRUD · P1 · M
**Loc:** routes exist `src/app/api/v1/api-keys/{route,[id]/route,[id]/rotate/route}.ts`; UI absent — `glob src/app/[locale]/dashboard/**/keys*` → 0 hits.
**Evidence:** GET/POST/DELETE/POST-rotate all wired with auth + zod + tierToRateLimit, but no settings page surfaces them. Customers cannot create or rotate API keys for the public v1 endpoints they're paying for. POST also lacks rate limit (key-creation can be spammed by hostile session).
**Fix:** Add `/dashboard/settings/api-keys/page.tsx` listing keys, "Create" modal returning the secret once (clipboard copy), Rotate / Revoke buttons. Add rate-limit `5/min` to POST /api/v1/api-keys.
**Effort:** M

### F-4 · Magic-link auth email mixed language: EN subject, VI body, no locale param · P1 · XS
**Loc:** `src/seed/auth/better-auth-server.ts:98` (subject `'Sign in to Sophia AI Factory'`) vs `184-196` (`buildMagicLinkHtml` body hardcoded VI: "Đăng nhập Sophia AI", "Nhấn nút bên dưới…"). EN-locale users on `/login` get EN subject + VI body.
**Evidence:** `magicLink.sendMagicLink({email, url})` doesn't receive locale; HTML is single-language. Welcome HTML at `167` is single-language EN. Receipt template parity not verified (likely also drift).
**Fix:** Plumb `request.headers.get('accept-language')` or session locale into magic-link callback; build bilingual templates keyed on `vi`/`en`. Same for welcome HTML.
**Effort:** XS

### F-5 · Better-Auth user.create hook inserts subscription without user_id/tier · P1 · XS
**Loc:** `src/seed/auth/better-auth-server.ts:139-144`
**Evidence:** `db.from('subscriptions').insert({ id, org_id, plan: 'basic', status: 'active' })`. Migration `0086` ADDed `user_id TEXT` and `tier TEXT`; both omitted on insert. `getUserTier` primary path queries `WHERE user_id = ?` returning null; falls through to org_members→org_id lookup which works. Brittle: any code path bypassing fallback returns BASIC. FREE100 / direct-redeem flow that doesn't create org will silently downgrade.
**Fix:** Add `user_id: user.id, tier: 'BASIC'` to the insert. Guarantees both lookup paths succeed.
**Effort:** XS

### F-6 · No email-verification gate before FREE100 redeem (50 MCU farm) · P1 · S
**Loc:** `src/app/api/promo/redeem-free/route.ts` (no `emailVerified` check); `better-auth-server.ts` (no `requireEmailVerification` plugin enabled).
**Evidence:** `grep emailVerified|requireEmail` in auth + redeem returns 0. Better-Auth signup auto-signs-in (`autoSignIn: true`); no verification email is sent. Bot-created accounts can immediately redeem FREE100 → 50 MCU each. Compounds with throwaway-domain abuse.
**Fix:** Enable Better-Auth `emailAndPassword.requireEmailVerification: true` OR gate FREE100 redeem on `user.emailVerified === true` from session, returning 403 with "verify email first" UX in `/redeem`.
**Effort:** S

### F-7 · Branding upload — old R2 object orphaned when extension changes · P2 · XS
**Loc:** `src/app/api/v1/branding/upload/route.ts:130-148`
**Evidence:** `r2Key = safeStorageKey(user.id, 'branding', '${kind}.${ext}')`. Upload PNG → `logo.png`. Re-upload SVG → writes new key `logo.svg` and persists URL but never deletes `logo.png`. R2 bills for orphans + privacy: old logo still publicly readable forever. Fallback URL on missing `R2_PUBLIC_BASE_URL` → `https://pub-placeholder.r2.dev/...` (broken link saved).
**Fix:** Before upload, list `users/${user.id}/branding/${kind}.*` and `bucket.delete()` non-matching extensions. Fail loudly (500) if `R2_PUBLIC_BASE_URL` unset rather than persist placeholder URL.
**Effort:** XS

### F-8 · No password-reset endpoint or UI · P2 · M
**Loc:** `grep password.*reset|forgot.*password` returns 0 across `src/`. Better-Auth supports `forgotPassword`/`resetPassword` but plugin not registered.
**Evidence:** `/api/auth/[...all]` proxies Better-Auth handler so reset endpoints would auto-mount IF the email transport were wired — currently `emailAndPassword` config has no `sendResetPassword` callback. `/login` page has no "Forgot password?" link. Customers locked out must email support.
**Fix:** Add `emailAndPassword.sendResetPassword` callback (same `sendEmail` helper, bilingual template). Add "Quên mật khẩu / Forgot?" link on login page → `/auth/reset` UI calling Better-Auth `forgetPassword`.
**Effort:** M

---

## Verified Live (curl)
- `GET /api/version` → `{"shortSha":"51bf5c00", deployedAt:"2026-05-09T10:06:41Z"}` (matches `git HEAD`)
- `GET /api/health` (unauth) → 200, redacted body — no env leak
- `POST /api/v1/agent-chat` (unauth) → 401 SSE error — auth gate works
- `GET /api/cron/mcu-monthly-reset` (unauth) → 401 — auth gate works
- `GET /welcome/abc` → 200 (would notFound on token len < 32)

## Skipped (deferred backlog or already shipped)
Phase-2 items, Wave 1-5 surfaces, webhooks unify, v1 28-route tier overlay, setup-wizard modularization, support-page strings, /dashboard/agents overlap.

## Unresolved Questions
1. F-1 evidence is purely static analysis — should curl-test the cron with secret to confirm `processed: 0` from prod logs, but `wasRecentlyRun` may suppress run.
2. F-5: does FREE100 redeem create org_members + subscription rows, or only mcu_balance? If skipped → tier lookup returns BASIC even for paid FREE100 users.
3. F-6: are throwaway-email signups already common? Check audit_log `customer_handover_consumed` events vs unique IPs to estimate abuse rate.
4. F-2 fix needs decision: pre-deduct then refund-on-error, OR balance-check-only-then-deduct (race risk for concurrent chats).
