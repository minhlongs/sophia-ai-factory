# Go-Live GAP Audit — Sophia AI Factory
**Date:** 2026-05-20 | **Auditor:** debugger agent | **Runtime:** ~8 min

---

## Section A: Production Status

- **SHA:** `3a1239b1` (deployed 2026-05-20T08:35:44Z) — matches git commit 4 from HEAD
- **Drift:** 3 commits unreleased (`4d59246a`, `a6cf4359`, `96ba02fe`) — ALL `docs(proof)` / `docs(sdk)` only, zero src/ changes. Safe drift, no code gap.
- **HTTP:** 200 (verified via /api/version endpoint, OpenNext 1.17.3)
- **Last deploy:** CF-direct via `scripts/deploy-with-sha.sh` on 2026-05-20 per git log and /api/version response

---

## Section B: GAPs Found

### Active GAPs (not yet fixed in HEAD)

**[P1] BASIC user onboarding UX trap — permanent setup-wizard lock for wizard-abandoners**
- Evidence: `src/middleware.ts:176` — middleware no longer forces `/setup-wizard` redirect (Bug D fix landed), but new BASIC users who never complete `onboarding_completed_at` still have no graceful empty-state dashboard. The middleware comment at `:176` explicitly notes this as deferred.
- Fix: Add `/dashboard` empty-state fallback for users with `onboarding_completed_at IS NULL` and tier = BASIC (skip wizard gate for BASIC).

**[P1] `post-merge-tests.yml` fires on every push to main — latent split-brain with CF-direct doctrine**
- Evidence: `.github/workflows/post-merge-tests.yml` has `on: push: branches: [main]`. The 2026-05-18 handover audit confirmed GH Actions currently disabled at account level (`total_count: 0` runs) — but if account is re-enabled, this workflow triggers `npm run ci:test` on every push. It does NOT deploy (no wrangler step), so it is not a deploy-conflict, but it will send "failing" notifications if tests fail post-push (they run in CI without CF bindings = expected failures).
- Fix: Rename to `post-merge-tests.yml.disabled` for consistency with `test.yml.disabled`; or add `if: false` guard.

**[P2] ElevenLabs TTS audio upload uses D1 fallback, not R2 — audio artifacts not persisted**
- Evidence: `src/lib/ai/text-to-speech-generator-elevenlabs.ts:1` — `TODO: storage not available in D1 client — audio upload needs Cloudflare R2 migration`. Audio is generated but not stored in R2 `VIDEO_BUCKET`.
- Fix: Route audio output to R2 `VIDEO_BUCKET` via `BACKUPS_BUCKET` binding pattern (binding already in `wrangler.toml`). Not a crash, but audio is ephemeral.

**[P2] Account lockout hook not wired at sign-in level — brute-force protection incomplete**
- Evidence: `src/seed/auth/account-lockout-hook.ts:27` — `TODO: When Better Auth adds a beforeSignIn/afterSignInFailed hook, wire checkAccountLock there`. Currently lockout only enforced by callers who explicitly call it at API layer.
- Fix: Wrap `/api/auth/sign-in` route to call `checkAccountLock` + `incrementFailedLogin` / `resetFailedLogin`. Existing logic in `account-lockout-hook.ts` is complete, only wiring is missing.

**[P2] 11 of 18 wired crons have never appeared in `cron_run_log`**
- Evidence: 2026-05-18 handover audit (L2) — `dunning`, `usage-export`, `uptime-check` + 8 others absent from `cron_run_log`. No crash observed, but silent cron failure is invisible.
- Fix: Add `cron_run_log` upsert to any cron route missing it; confirm with manual trigger via `/api/cron/<name>?cron_secret=...`.

**[P2] Mastodon publisher mock-mode silently active when `MASTODON_INSTANCE_URL` env absent**
- Evidence: `src/lib/publishing/mastodon.ts:14` — `return !process.env.MASTODON_INSTANCE_URL` triggers mock mode. No env var in `wrangler.toml` secrets section found for this key. Mastodon publish attempts return `mock_mastodon_*` IDs silently.
- Fix: Confirm if Mastodon is in scope for go-live. If yes, set `MASTODON_INSTANCE_URL` via `wrangler secret put`. If no, document mock-mode as intentional.

### Confirmed Fixed in HEAD (were P0/P1 in 2026-05-19 bughunt)

- Bug A (`/api/csp-report` 500): FIXED — `export const runtime='edge'` removed, note added at `route.ts:11-14`
- Bug B (CSP nonce missing on setup-wizard): FIXED — `setup-wizard` exclusion removed from middleware matcher (`middleware.ts:264-269`)
- Bug C (`/dashboard/affiliate` Server Component crash): FIXED — `Promise.all` wrapped in try/catch at `affiliate/page.tsx:66-77`

---

## Section C: Areas Verified Clean

- **TypeScript:** `tsc --noEmit` exits 0 — zero compile errors
- **`@ts-ignore` / `@ts-nocheck`:** 0 occurrences in src/
- **TODO/FIXME count:** 24 total across 13 files — none are P0; all are deferred features or upstream tracker dependencies
- **Hardcoded secrets:** 0 raw API keys in src/ — NOWPayments key references are all `process.env.NOWPAYMENTS_IPN_SECRET` or setup-wizard user-supplied flow (correct)
- **Critical flow — Better Auth session:** `src/seed/auth/better-auth-session.ts` exists, exports `getCurrentUser()` at line 39
- **Critical flow — DB client:** `src/seed/db/client.ts` exists, exports `createServerClient()` (sync) at line 56
- **Critical flow — Tier config:** `src/seed/config/tiers/index.ts` + `tier-configs.ts` + `unified-limits.ts` all present
- **Critical flow — NOWPayments IPN webhook:** `src/app/api/webhooks/nowpayments/route.ts` — HMAC-SHA512 verification present, `NOWPAYMENTS_IPN_SECRET` env-gated
- **Critical flow — Setup wizard route:** `src/app/[locale]/setup-wizard/` and `src/app/api/setup-wizard/` both exist
- **Critical flow — Telegram webhook:** `src/app/api/webhooks/telegram/route.ts` exists; bot handler at `src/tree/telegram/telegram-bot.ts`
- **Migrations:** 117 migration files in `migrations/`, sequential 0001–0117, `migrations_dir` wired in `wrangler.toml`. No detected gap.
- **Production SHA drift:** 3 unreleased commits are docs-only — no code regression unreleased
- **TECH_DEBT_TRACKING.md:** All phases 40–49 COMPLETE; TS errors at 0 (closed 2026-04-27); no open P0 items

---

## Section D: Recommended /debug Targets (ranked)

1. **[P1] BASIC user onboarding UX trap**
   Start: `src/middleware.ts:136` (check `onboarding_completed_at` gate logic) + `src/app/[locale]/dashboard/page.tsx` (add empty-state for null onboarding). The middleware comment at `:176` describes the exact intended fix.

2. **[P1] `post-merge-tests.yml` active on push to main**
   Start: `/Users/macbook/projects/sophia-ai-factory/.github/workflows/post-merge-tests.yml:6` — add `if: false` or rename to `.disabled`. 2-minute fix.

3. **[P2] Account lockout not wired at sign-in**
   Start: `src/seed/auth/account-lockout-hook.ts:27` (TODO comment) → then `src/app/api/auth` to find the custom sign-in wrapper route and add `checkAccountLock` / `incrementFailedLogin` calls.

---

## Section E: Unresolved Questions

1. **Is Mastodon publishing in scope for go-live?** If yes, `MASTODON_INSTANCE_URL` must be set; if no, mock-mode should be documented as intentional to prevent future confusion.

2. **Is the `post-merge-tests.yml` silent currently only because GH Actions is disabled at account level?** If the account restriction is lifted (e.g., billing tier change), this workflow immediately fires on next push. Needs explicit disable or architectural decision.

3. **Affiliate dashboard crash (Bug C) was fixed with try/catch — but root cause (D1 column mismatch in `commission_ledger`) was not resolved in the 2026-05-19 bughunt.** Is `withheld_cents` column present in remote D1? Needs `wrangler d1 execute sophia-raas-db --command "SELECT sql FROM sqlite_master WHERE name='commission_ledger'"` to confirm.
