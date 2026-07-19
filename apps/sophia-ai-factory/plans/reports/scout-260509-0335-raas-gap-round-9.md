# Round 9 GAP scout — Sophia AI Factory

Branch: main @ `6be7cb05` (Wave 6 LIVE). Live SHA matches local.
Date: 2026-05-09 03:35
Focus: un-scouted surfaces (MFA, BYOK test, SSE stream, webhook test, batch usage, upload, admin RBAC, SOP detail, telegram pair, rotate endpoint).

---

## TOP-8 P0/P1 GAPs

### F-1 [P0] TOTP secrets stored in plaintext
- **Location:** `src/seed/auth/mfa/totp-service.ts:18-26`, `src/app/api/auth/mfa/setup/route.ts:42-58`
- **Evidence:** `generateTotpSecret()` returns `totp.secret.base32`. `mfa_secrets.totp_secret_enc` column name implies encryption but value passed unwrapped to `update`/`insert`. No KMS, no AEAD wrap, no Web Crypto seal. Migration `0028-mfa-secrets.sql` confirms TEXT column with no encryption layer.
- **Fix:** Add AES-GCM seal/unseal helpers using `MFA_SECRET_KEY` Workers secret; wrap on write, unwrap on `verifyTotp`. Backfill existing rows on next setup.
- **Effort:** M

### F-2 [P0] SOP detail page passes Server-side functions to Client Component
- **Location:** `src/app/[locale]/dashboard/sops/[id]/page.tsx:86-99`
- **Evidence:** Server Component (`async export default`) passes `onRunNow`, `onDelete`, `onSavePlaybook`, `onSaveConfig`, `onRegenSecret` as inline arrow funcs to `<SopDetailTabs>` which is `'use client'`. Next.js disallows non-serializable function props across the RSC boundary → runtime error or silent no-op.
- **Fix:** Pass server-action functions directly (without wrapper) — server actions are serializable refs in Next 16. Drop arrow indirection: `onRunNow={runNowAction.bind(null, id)}` or move action invocation to client-side via fetch.
- **Effort:** S

### F-3 [P1] /api/v1/api-keys/[id]/rotate has NO rate limit
- **Location:** `src/app/api/v1/api-keys/[id]/rotate/route.ts:33-59`
- **Evidence:** POST `/api-keys` is wrapped with `withRateLimit({intervalMs:60_000, maxRequests:5})` but `[id]/rotate` is bare `export async function POST`. Rotation creates new key + revokes old → equivalent abuse surface (DB write spam, audit log spam, leaked-via-monitor key churn).
- **Fix:** Apply same `withRateLimit` wrapper as parent route. Also DELETE `[id]/route.ts` lacks wrapper.
- **Effort:** XS

### F-4 [P1] /api/v1/usage/batch has no per-request rate limit
- **Location:** `src/app/api/v1/usage/batch/route.ts:81-178`
- **Evidence:** Schema caps 1000 events/req but no `withRateLimit` wrapper. Attacker with API key can submit 1000-event batches at full speed → quota DoS, D1 contention. Heaviest write endpoint in `/v1`. Validates `key_hash` against plaintext `apiKey` (line 57) — works only if keys stored plaintext (security smell — verify).
- **Fix:** Add `withRateLimit({intervalMs:60_000, maxRequests:10, key:apiKey})` after auth. Confirm key hashing strategy.
- **Effort:** S

### F-5 [P1] Logo/favicon upload allows raw SVG (XSS vector)
- **Location:** `src/app/api/v1/branding/upload/route.ts:32-42`
- **Evidence:** `IMAGE_MIME_ALLOWLIST` includes `'image/svg+xml'`. SVG can carry inline `<script>`, `<foreignObject>`, `onload=` handlers. Logo URLs rendered into `<img src>` are safe, but R2 public bucket serves SVG with `Content-Type: image/svg+xml` → if a tenant fetches another tenant's logo via direct URL or admin previews via `<object>` / `iframe`, XSS in admin context.
- **Fix:** Drop `image/svg+xml` from allowlist OR sanitize SVG via DOMPurify on upload. Workers-compatible: regex-strip `<script|on\w+=|javascript:` before R2 PUT.
- **Effort:** S

### F-6 [P1] BYOK lacks key-validity test endpoint
- **Location:** `src/app/api/user/byok/route.ts` (POST), `src/app/api/health/byok/route.ts`
- **Evidence:** `POST /api/user/byok` validates regex shape only, never tests key against provider API. User submits invalid OpenRouter/ElevenLabs key → success → first mission fails 30 min later with cryptic error. `health/byok` only counts providers, not validity. Setup wizard in handover protected-flow promises "key works".
- **Fix:** Add `POST /api/user/byok/test {provider}` that pings provider's /models or /user endpoint; return `{ok, latency, error}`. Connect-and-test button on settings → BYOK page.
- **Effort:** M

### F-7 [P1] Mission SSE stream silently swallows DB errors
- **Location:** `src/app/api/v1/missions/[id]/stream/route.ts:65-95`
- **Evidence:** Inside the polling loop, `try { ...db.select... } catch { /* keep polling */ }`. If `data.result` JSON-parse fails (line 82), exception falls into the same catch → client sees stale data forever. No `Last-Event-ID` reconnect support; no heartbeat ping (clients assume dead at >10s of silence). On Cloudflare Workers, sub-request budget for 5-min loop with 150 DB calls is risky.
- **Fix:** Send periodic `event: ping` (every 15s); emit `event: error {code,detail}` on exceptions; wrap `JSON.parse(data.result)` in own try; honor `Last-Event-ID` to skip already-sent statuses; reduce poll to 3s.
- **Effort:** M

### F-8 [P1] /api/v1/webhooks/[id]/test enables tenant-driven SSRF + DoS amplifier
- **Location:** `src/app/api/v1/webhooks/[id]/test/route.ts:26-109`
- **Evidence:** Authenticated user can hit own webhook URL repeatedly with no rate limit. `sendWebhook()` will fire to whatever URL was registered → if SSRF protections in `sender.ts` are missing (registry should block private CIDR / metadata IP), tenant can use this endpoint as a private-network probe. Also duplicates payload-build code in if/else branch (DRY).
- **Fix:** (a) Add `withRateLimit({maxRequests:5, intervalMs:60_000, key:userId})`. (b) Confirm `sender.ts` blocks `169.254.169.254`, `127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `::1`. (c) Refactor duplicated payload object.
- **Effort:** S

---

## P2 (deferred / minor)

- **F-9 [P2]** `OnboardingStatusWidget` hardcodes VI/EN strings (`onboarding-status-widget.tsx:51-72`) — bypasses next-intl. Pattern flagged in Phase 2 backlog.
- **F-10 [P2]** Two `/api/admin/llm-*` routes use `CRON_SECRET` instead of admin-session check → hidden under `/api/admin/*` prefix. Acceptable but inconsistent — rename to `/api/cron/llm-*` or add admin-session fallback.

---

## Verified live (curl)

- `GET /api/version` → 200, `shortSha":"6be7cb05"` (matches local).
- `POST /api/v1/api-keys/test-id/rotate` → 401 (auth gate works); no `X-RateLimit-*` headers (confirms F-3).
- `/en/dashboard/sops/test-id` → 308 redirect to non-locale path (locale-handling artifact, not a bug).

---

## State of dashboard (≤200 words)

Sophia is live, SHA-matched, and the recent waves shipped solid auth/i18n/admin ops surfaces. Round 9 finds the un-scouted **security-edge layer** is the weakest. **F-1 (TOTP plaintext) is the headline P0** — anyone who reads `mfa_secrets.totp_secret_enc` from a D1 dump can clone all enrolled second factors; column naming gives false confidence. **F-2 (SOP detail page passes server funcs to client)** is the second P0: a ~/dashboard page silently breaks runtime React rules and may not render its actions. Beyond those, three rate-limit gaps (F-3 rotate, F-4 batch usage, F-8 webhook test) form a coherent class — perimeter `/v1` got rate-limit wrappers in Wave 6 but several mutating endpoints were missed. F-5 (SVG upload) and F-6 (BYOK no key-test flow) are UX-blocking polish for the protected-flow setup wizard. F-7 SSE silent errors degrade the mission detail page's reliability story. Recommended sprint: F-1 + F-2 + F-3 + F-4 + F-5 today (XS/S each), F-6 + F-7 + F-8 next iteration. No regressions detected in already-shipped Wave 1B-6 surfaces.

## Unresolved questions

- F-4: confirm whether `raas_api_keys.key_hash` stores plaintext or SHA-256 hash — code path queries `eq('key_hash', apiKey)` which only works if plaintext is stored; if hashed, batch-usage auth is broken silently.
- F-5: does R2 `Content-Disposition` header mitigation (force `attachment`) already exist? Not seen in upload code.
- F-2: does `runNowAction` etc. work despite the RSC→Client violation, or has it been silently failing since launch? Worth a Sentry query.
