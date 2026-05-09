# Round-10 GAP Scout — Sophia AI Factory

**Branch:** main @ `e400b841` (Wave 7 LIVE)
**Scope:** un-scouted operational/UX corners
**Method:** code-only inspection + 5 live curls. No code modified.

---

## TOP-8 GAPs (Ranked)

### F-1 (P0): Welcome magic-link consume race
**Location:** `src/tree/handover/handover-magic-link.ts:80-90` + `src/app/api/welcome/validate/[token]/route.ts:106-116`
**Evidence:** POST validates token then `consumeMagicLink(handover.id)` clears state via `UPDATE ... WHERE id = ?2` — no token guard. Two concurrent POSTs with same captured link both pass `validateMagicLinkToken`, both invoke consume (idempotent UPDATE), BOTH mint Better Auth sessions before clear lands. Single-use comment in code, but DB-level race wide open.
**Fix:** `UPDATE customer_handovers SET ... WHERE id = ?1 AND magic_link_token = ?2` and check `meta.changes > 0`; bail when 0 — second writer loses race, returns 410.
**Effort:** S

### F-2 (P0): /v1/usage/batch zero idempotency
**Location:** `src/forest/usage-metering/usage-kv-sync.ts:118-148`
**Evidence:** `BatchUsageRecord` has no `event_id` / `external_id` field; insert into `usage_events` carries no idempotency key; same batch retried by client = double-counted credits + double-billed quota. POST `/v1/usage/batch` is publicly documented for SDK retries.
**Fix:** Add optional `event_id` (uuid v4) to `BatchUsageRecord` schema, persist as `usage_events.external_id` UNIQUE, swallow conflicts as `success: true, deduplicated: true`.
**Effort:** M

### F-3 (P1): MFA UI never fetches initial enabled state
**Location:** `src/app/[locale]/settings/security/mfa/page.tsx:34` (`mfaEnabled` defaults `false`)
**Evidence:** No GET `/api/auth/mfa/status` endpoint exists; component initialises `mfaEnabled=false` then ONLY flips true after fresh enrollment in current session. Refresh page → user sees "Disabled" + Setup button despite TOTP being enabled in DB. Pressing Setup overwrites `totp_secret_enc` (route does upsert at line 43) → user locked out.
**Fix:** Add GET `/api/auth/mfa/status` returning `{ enabled: bool }` (read `mfa_secrets.totp_enabled`); fetch on mount; gate Setup button.
**Effort:** S

### F-4 (P1): Dunning banner hardcoded English
**Location:** `src/forest/components/billing/dunning-status-banner.tsx:33-66`
**Evidence:** `DUNNING_CONFIG` literal strings ("Payment Past Due", "Account Delinquent", "Service Suspended"), date format `toLocaleDateString()` no locale param. Phase 2 backlog covers privacy/terms/support i18n; THIS billing surface missed. Vi customer sees English on most stressful flow.
**Fix:** Wire `useTranslations('dashboard.billing.dunning')`; map state→key; pass locale to `toLocaleDateString(locale)`.
**Effort:** S

### F-5 (P1): admin/payouts/queue cursor pagination broken
**Location:** `src/app/api/admin/payouts/queue/route.ts:55-65`
**Evidence:** `WHERE balance_available >= ? AND user_id > ?` paired with `ORDER BY balance_available DESC` — cursor is on user_id but ordering on balance. Page 2 will skip users with balance > cursor's balance and id < cursor's id, OR duplicate users. Pagination unusable for >1 page in /admin/payouts UI.
**Fix:** Either order by `balance_available DESC, user_id ASC` and use compound cursor `(balance, user_id)`, OR switch to OFFSET pagination for admin-only endpoint.
**Effort:** S

### F-6 (P1): Telegram OTP code uses Math.random
**Location:** `src/lib/telegram/pairing.ts:35-37`
**Evidence:** `generate6DigitCode()` uses `Math.random()` not `crypto.getRandomValues()`. 6-digit codes already small (1M space). Math.random in V8 isolate is predictable across calls within request boundary. Severity reduced because `/pair_approve` is admin-gated (route.ts:102), but defence-in-depth: BYOK vault keys / future MFA-style pairing should use CSPRNG.
**Fix:** Use `crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000`.
**Effort:** XS

### F-7 (P2): /api/admin/handover/customer-status mis-routed
**Location:** `src/app/api/admin/handover/customer-status/route.ts:17-21`
**Evidence:** Route mounted under `/api/admin/*` but uses `getCurrentUserFromHeaders` (not `requireAdmin`) — explicit "No admin required — authenticated user fetches their own handover". Confuses RBAC audits, breaks generic `/api/admin/*` middleware policies (e.g. tighter rate limits, IP allowlists), trips `requireAdmin` auditors.
**Fix:** Move to `/api/me/handover-status` or `/api/handover/me`. Leave 308 redirect on old path for one release.
**Effort:** XS

### F-8 (P2): Branding upload no magic-byte verification
**Location:** `src/app/api/v1/branding/upload/route.ts:115-125`
**Evidence:** MIME allowlist relies on `fileEntry.type` (client-supplied multipart Content-Type header — trivially spoofable). A `.png` named file with arbitrary bytes (e.g. polyglot HTML/JS) passes allowlist, lands in R2 under user-namespaced path, served from `R2_PUBLIC_BASE_URL` with whatever Content-Type R2 returns. Combined with R2 wildcard CSP this is a stored-XSS vector.
**Fix:** Read first 16 bytes, match against PNG (89 50 4E 47), JPEG (FF D8 FF), WebP (52 49 46 46 .. 57 45 42 50), ICO (00 00 01 00) magic bytes; reject mismatch. Serve via Worker that pins Content-Type from sniff result, not from upload.
**Effort:** M

---

## State of the Dashboard (≤ 200 words)

After Wave 7 the platform's strategic security gaps (TOTP encryption, SOP RSC, rate-limits, SSE heartbeat) are closed. Round 10's surface scan turns up tactical leaks rather than systemic flaws: a magic-link race that can mint duplicate sessions (F-1, P0), a usage-metering ingestion path with zero dedup that lets retries double-bill (F-2, P0), and a stale-state MFA UI that can lock users out by silently rotating their TOTP secret (F-3). Operational polish issues — dunning banner's hardcoded English (F-4), broken admin payout pagination (F-5), Math.random OTP in admin Telegram pairing (F-6), one mis-routed admin path (F-7), and unverified-magic-byte uploads (F-8) — are all S/XS effort. None of these are deferred backlog items. The platform is GREEN; production HTTP 200 + auth-gated endpoints respond correctly. Next wave should bundle F-1 + F-2 + F-3 (all customer-data-integrity) and ship the remaining quick fixes as a cleanup pass. After this round, scoutable-surface-area on operational corners is approaching exhaustion — future scouts should pivot toward perf/load and cost-attribution audits.

---

## Verification

- `curl -sI /api/v1/usage/batch` → 405 (live, GET-blocked) ✓
- `curl -sI /api/v1/api-keys` → 401 (live, auth-gated) ✓
- `curl -sI /api/welcome/validate/zzz...zzz` → 404 (live, route exists) ✓
- `curl -sI /api/admin/payouts/queue` → 401 (live, admin-gated) ✓
- `curl -s /api/admin/llm-cache-stats` → `{"error":"Unauthorized"}` (CRON_SECRET path) ✓

## Unresolved Questions

1. F-2 idempotency: should TTL on dedup be 24h (rolling) or per-billing-period? Per-period is cheaper but invites cross-period replay.
2. F-1 race: is there observed evidence in prod logs of duplicate session mints, or is this purely theoretical?
3. F-8 magic-byte: is R2 binding configured to override Content-Type, or does `pub-*.r2.dev` pass through whatever client sent?
4. F-7 reroute: are there mobile clients pinned to `/api/admin/handover/customer-status`? 308 redirect should be safe but worth confirming.
