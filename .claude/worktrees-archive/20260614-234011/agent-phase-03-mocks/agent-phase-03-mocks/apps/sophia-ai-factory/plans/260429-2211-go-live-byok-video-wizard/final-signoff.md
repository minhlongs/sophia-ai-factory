---
title: Go-Live Hardening — BYOK + Video Gen + Setup Wizard — Final Sign-Off
date: 2026-04-29
mode: /cook --auto --parallel
status: SHIPPED — 1731/1762 tests, SHA 4ecbe7a8 match, all smokes GREEN
---

# Go-Live Hardening Bundle

**Predecessor:** [260429-2129-affiliate-catalog-public](../260429-2129-affiliate-catalog-public/final-signoff.md) (239fd4ba)

## Goal

User intent: "go live khách tự nhập Key của riêng họ và run gen video tự động full flow zero bug".

Audit + fix 3 critical user flows for go-live readiness:
1. BYOK admin — customer key management
2. Video gen — script→video end-to-end
3. Setup wizard — onboarding for non-tech CEO

## Method (--auto --parallel)

3 parallel scout agents (Explore) → synthesize 10 P0 ship-blockers → 3 parallel fullstack-developer agents with strict file ownership boundaries → cross-verify (TS+vitest) → code-reviewer (8.0/10) → 2 follow-up fixes (existing-user wizard cookie + webhook 503→200) → 1 deploy fix (force-dynamic) → manual deploy + verify.

## Files Changed (24)

### NEW (1)
- `src/middleware/rate-limit-tiers.ts` — added /api/user/byok/* admin tier rule

### MODIFIED — BYOK Admin (6)
- `src/app/api/user/byok/route.ts` — muapi added, Zod field errors, format regex superRefine
- `src/app/api/user/byok/route.test.ts` — 5 new tests, 15 total
- `src/lib/byok/user-api-key-store.ts` — kept heygen for back-compat (DB type)
- `src/components/byok/byok-key-form.tsx` — 5 user-settable providers, removed heygen
- `src/app/[locale]/dashboard/byok/page.tsx` — bilingual provider→feature mapping
- `src/middleware/rate-limit-tiers.ts` — already listed above

### MODIFIED — Video Gen (5)
- `src/app/api/heygen/create-video/route.ts` — tier gate (BASIC→402)
- `src/app/api/heygen/avatars/route.ts` — 5-min module-level cache
- `src/app/api/heygen/voices/route.ts` — 5-min module-level cache
- `src/app/api/webhooks/heygen/route.ts` — 200+cron-poll fallback when secret missing
- `src/app/api/heygen/api-routes.test.ts` — 8 new tests, 16 total

### MODIFIED — Setup Wizard (8)
- `src/app/setup-wizard/layout.tsx` — auth check + existing-user cookie redirect + force-dynamic
- `src/app/setup-wizard/page.tsx` — anthropic state, LLM guard, retry state
- `src/app/setup-wizard/components/steps/api-keys-step.tsx` — heygen→anthropic field
- `src/app/setup-wizard/components/steps/finish-step.tsx` — bilingual + retry button
- `src/app/setup-wizard/components/steps/api-keys-step.test.tsx` — 7 tests
- `src/app/api/setup/save/route.ts` — Zod refine ≥1 LLM key, anthropic provider, wizard_done cookie
- `src/app/api/setup/save/route.test.ts` — 6 tests
- `src/app/api/setup/verify/route.ts` — muapi + anthropic verify cases
- `src/middleware.ts` — wizard_done cookie check on /dashboard exact path
- `messages/en.json` / `messages/vi.json` — heygen→anthropic entry

## P0/P1 Fixes (14 + 3 follow-up)

| # | Flow | Severity | Fix |
|---|------|----------|-----|
| 1 | BYOK | P0 | Provider enum aligned (route+form+store) |
| 2 | BYOK | P0 | Rate-limit rule for /api/user/byok/* |
| 3 | BYOK | P1 | Zod field errors exposed |
| 4 | BYOK | P1 | Provider-specific key format regex |
| 5 | BYOK | P1 | Bilingual provider→feature UI hints |
| 6 | Video | P0 | Tier gate on create-video (BASIC→402) |
| 7 | Video | P0 | 5-min cache on avatars |
| 8 | Video | P0 | 5-min cache on voices |
| 9 | Video | P0 | Webhook fallback when secret missing |
| 10 | Wizard | P0 | Auth check on /setup-wizard layout |
| 11 | Wizard | P0 | Require ≥1 LLM key (openrouter|anthropic) |
| 12 | Wizard | P0 | Post-signup wizard_done cookie redirect |
| 13 | Wizard | P0 | MuAPI + Anthropic verify cases |
| 14 | Wizard | P1 | Retry button + bilingual finish step |
| F1 | Wizard | P0 | Existing-user guard (skip wizard if has LLM key) |
| F2 | Video | P1 | Webhook 503→200 (avoid HeyGen retry storm) |
| F3 | Wizard | P0 | force-dynamic export — was rendering static, redirect 500 |

## Deferred

- **Quota enforcement on video creation** — needs schema decision (credit-deduct vs separate counter). Documented in fullstack-260429-2211-video-gen-fixes.md.
- **Rate-limit rule on /api/setup/verify** — middleware default (30 req/min) covers; explicit rule deferred.

## Verification Pipeline

- [x] `npx tsc --noEmit` → 0 errors
- [x] `npx vitest run` → **1731/1762 pass** (+16 net vs baseline 1715)
- [x] `npm run build` → success (/setup-wizard ƒ Dynamic confirmed)
- [x] code-reviewer 8.0/10 → 2 follow-up fixes applied → re-verify GREEN
- [x] `git push origin main` (cf8b89c5 + 4ecbe7a8)
- [x] `npm run deploy:build` + `npx wrangler deploy --name sophia-ai-factory`
- [x] `wrangler-set-build-vars.sh` (DEPLOYED_AT + DEPLOY_BRANCH + COMMIT_SHA)
- [x] `/api/version` shortSha = local 4ecbe7a8 ✅
- [x] Production smoke 7/7 GREEN:
  - `/` → 200
  - `/setup-wizard` → 307 redirect (was 500 before force-dynamic fix)
  - `/api/user/byok` → 401 (auth required)
  - `/api/heygen/avatars` → 401 (auth required)
  - `/api/heygen/create-video` POST → 401 (auth required, tier gate after auth)
  - `/api/webhooks/heygen` POST no-sig → 401 missing_signature (secret IS set in prod)
  - `/api/affiliate-discovery` → 200 with 10 offers (prior batch still live)

## Score Summary

| Item | Result |
|---|---|
| Test count | 1715 → **1731** (+16 net) |
| TS errors | 0 |
| Code review | **8.0/10** + 2 follow-ups applied |
| Production SHA | 4ecbe7a8 ✅ match |
| Smoke endpoints | 7/7 GREEN |
| Files changed | 24 |
| Lines net | ~+450 (incl. tests + bilingual i18n) |

## Open Questions

1. **Video quota strategy** — credit-deduct via existing licenseNonce flow OR new monthly video count table? Pick before BYOK users start spamming.
2. **MuAPI live verify** — currently format-check only. If MuAPI exposes a public test endpoint, wire it up.
3. **HeyGen cache scope** — module-level Map per CF isolate. Is fan-out across isolates acceptable, or upgrade to KV cache?
4. **`wizard_done` cookie deletable client-side** — acceptable trade-off, but consider HMAC-signed cookie if abuse appears.

## Next Steps

1. ~~git push + deploy + verify~~ ✅ done (4ecbe7a8)
2. ~~docs sync~~ → in progress (docs-manager subagent)
3. (deferred) video quota schema decision
4. (deferred) live MuAPI verify endpoint when available
5. (deferred) Telegram bot activation when user provides BotFather token
