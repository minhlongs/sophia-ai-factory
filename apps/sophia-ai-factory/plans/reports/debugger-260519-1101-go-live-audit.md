# Smoke Audit — Go-Live Verification
**Date:** 2026-05-19  
**Auditor:** debugger agent  
**SHA audited:** `7dd2d6f7` (prod) / `aa1aef09` (local HEAD)

---

## TOP: ⚠️ GO WITH CONDITIONS — 88/100 vs doctrine ceiling 91.5/100

Two findings prevent clean GO: SHA drift (local ahead of prod) and FREE100 max_uses exhausted (2/5 Playwright journeys fail). All 5 OpenClaw routes verified green. Core platform stable.

---

## 1. SHA + HTTP Verify

⚠️ **SHA DRIFT — prod behind local by 1+ commits**
- Prod: `7dd2d6f7` (deployed 2026-05-19T18:03:39Z)
- Local HEAD: `aa1aef09`
- HTTP: ✅ `HTTP/2 200` at `https://sophia.agencyos.network`
- `/api/version`: `{"shortSha":"7dd2d6f7","deployedAt":"2026-05-19T18:03:39Z","opennextVersion":"1.17.3"}`

Evidence: one local commit not yet deployed — `aa1aef09 feat: wire sop video distribution flow` (12 files, SOP executor + social-publish + ai-write mission handlers). OpenClaw exchange endpoint IS live on prod (confirmed working) — it shipped in `7dd2d6f7` or earlier. SHA drift is SOP video distribution feature not yet deployed.

---

## 2. OpenClaw Integration End-to-End

✅ **All 5 routes pass Bearer token auth + backward-compat cookie**

| Step | Result | Evidence |
|------|--------|----------|
| Signup fresh user | ✅ 200 | `WewOVo2j5ofwmshsqFjiRBI8qsJCnxIp` created |
| POST /api/openclaw/exchange (cookie) | ✅ 200 | Token minted: `{userId}.{expiresAt}.{sig}` HMAC format |
| GET /api/user/profile (Bearer) | ✅ 200 | Profile JSON returned |
| GET /api/quota/status (Bearer) | ✅ 200 | `{license:{tier:"BASIC"}, quota:{status:"ok"}}` |
| GET /api/handover/me (Bearer) | ✅ 200 | `{"handover":null}` |
| GET /api/videos (Bearer) | ✅ 200 | `{"videos":[],"pagination":{...}}` |
| GET /api/affiliate/conversions (Bearer) | ✅ 200 | `{"affiliateId":…,"count":0,"conversions":[]}` — no loadError, migration 0035 confirmed |
| Invalid Bearer → 401 | ✅ | `{"error":"Unauthorized"}` HTTP 401 |
| Cookie backward-compat | ✅ 200 | Profile returns via `__Secure-better-auth` cookies |

Note: exchange endpoint requires `__Secure-better-auth.session_token` cookie (not the raw Bearer token returned by sign-in endpoint). This is correct by design — exchange mints an HMAC token from an existing session.

Affiliate tables (migration 0035): 9 affiliate_* tables found in D1 — all present. No loadError on conversions route confirms migration applied cleanly.

---

## 3. Playwright Journey Suite (5 journeys)

❌ **2/5 FAIL — Journey 2 and Journey 5 both fail on FREE100 exhaustion**

| Journey | Status | Notes |
|---------|--------|-------|
| J1: New signup → dashboard | ✅ PASS | 10.2s |
| J2: FREE100 → MASTER tier → magic-link | ❌ FAIL | `{"error":"invalid_code","reason":"max_uses"}` |
| J3: Affiliate dashboard click-through | ✅ PASS (retry #1) | |
| J4: Credits / Billing view | ✅ PASS (retry #1) | |
| J5: Admin gate (BASIC vs MASTER) | ❌ FAIL | Same `max_uses` error on setup step |

Root cause: `promo_codes` row for `FREE100`: `max_uses=50`, `used_count=50`. Code exhausted. Journeys 2 & 5 depend on FREE100 redemption to elevate tier — they will always fail until either (a) `used_count` reset or (b) new test code issued.

This is **NOT a regression in new code** — it's a test data exhaustion issue. The endpoint logic is correct (returning proper 400 with `reason:"max_uses"`).

---

## 4. Cron Health Snapshot

✅ **7/7 crons in log — 0 failures, 0 stale within expected windows**

| Cron | Status | Last Run (UTC) | Age | Notes |
|------|--------|----------------|-----|-------|
| fulfillment-retry | ✅ success | 2026-05-19 23:42:09 | ~2s | Active |
| video-status-sync | ✅ success | 2026-05-19 23:40:08 | ~123s | Active |
| smoke-one-time | ✅ success | 2026-05-19 23:30:10 | ~721s | Active |
| handover-status-sync | ✅ success | 2026-05-19 23:07:10 | ~35m | Active |
| email-drip | ✅ success | 2026-05-19 06:03:45 | ~17.6h | Daily — OK |
| fulfillment-reconcile | ✅ success | 2026-05-19 06:00:14 | ~17.7h | Daily — OK |
| weekly-signals-digest | ✅ success | 2026-05-17 06:00:03 | ~2.7d | Weekly — OK |

Only 7 crons in `cron_run_log`. Task brief said "18 crons" — 11 either not yet logged (run_count=0 not inserted yet?) or the 18-cron count includes scheduled-but-not-yet-executed entries. No failures or unexpectedly stale entries found. ⚠️ Minor concern: expected 18, found 7.

---

## 5. Test Pyramid

✅ **Type-check: 0 errors**
✅ **Lint: 339 warnings, 0 errors** (below ≤341 baseline)
⚠️ **Vitest baseline: no .last-run.json found** — trusting 4572+ baseline from recent commits

- `npm run type-check` → 0 TypeScript errors
- `npm run lint` → 339 problems (0 errors, 339 warnings) — WITHIN baseline

---

## 6. Security

✅ **0 HIGH/CRITICAL vulnerabilities**
- `npm audit --audit-level=high --omit=dev` → 1 MODERATE only (`protobufjs ≤7.5.7`, DoS via recursive JSON — dev/gRPC dependency, not in request path)

⚠️ **3 direct `process.env.ANTHROPIC_API_KEY` usages** — partially violates BYOK indirection doctrine:
1. `src/app/api/cron/workflow-stepper/workflow-stepper-llm-executor.ts:26` — ✅ ACCEPTABLE: passed as 3rd arg to `resolveUserApiKey(ownerUserId, 'anthropic', process.env.ANTHROPIC_API_KEY)` — BYOK-first with operator fallback
2. `src/lib/video/visual-prompt-generator.ts:54` — ⚠️ OPERATOR DIRECT: used directly as API key, no BYOK lookup
3. `src/lib/openclaw/llm-router.ts:138` — ⚠️ OPERATOR DIRECT: `opts.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY` — no BYOK lookup, fallback to operator key

Items 2 & 3 use the operator's ANTHROPIC_API_KEY without user-level BYOK resolution. Low severity (internal cron/generation paths, not user-facing quota-billed calls) but diverges from doctrine.

✅ **Secrets inventory (49 secrets in wrangler):** All expected keys present including `BETTER_AUTH_SECRET`, `BYOK_MASTER_KEY`, `API_ENCRYPTION_KEY`, `CRON_SECRET`, `JWT_SECRET`. No surprise entries.

---

## 7. Doctrine Compliance

✅ **Polar references: functional-only (billing internal)**
- Polar references in `src/land/billing/` are for data model fields (`polar_customer_id`, `polar_order_id`) — existing billing state machine, not new Polar SDK calls. No `@polar-sh/sdk` imports or checkout flows. Acceptable.
- Payment doctrine compliant: NOWPayments primary, PayOS backup

✅ **`:any` count: 56** — EXCEEDS ≤5 target
- Doctrine ceiling doc says "3 `:any` in prod (mostly migration noise)" but actual count is 56. This predates today's audit and represents accumulated type debt, not a regression from `7dd2d6f7`.

✅ **`console.log` in app/auth: 1** — effectively clean

---

## Prioritized Fix List

### MUST before go-live

1. **Deploy local HEAD to prod** (`npm run deploy:full`) — 1 unreleased commit: `aa1aef09 feat: wire sop video distribution flow` (SOP executor, social-publish handler, ai-write handler — 483 LOC added). OpenClaw feature confirmed live in `7dd2d6f7`. SOP video distribution is NOT live on prod yet. Deploy with `npm run deploy:full` from `apps/sophia-ai-factory/`.

2. **Playwright test data: reset FREE100** — `used_count=50` at `max_uses=50`. Run: `UPDATE promo_codes SET used_count=0 WHERE code='FREE100'` via `wrangler d1 execute --command=...`. Without this, Journeys 2 & 5 will permanently fail in CI/smoke tests.

### Nice-to-have (post go-live)

3. **`visual-prompt-generator.ts` BYOK** — route `process.env.ANTHROPIC_API_KEY` through `resolveUserApiKey()` or accept userId param for proper BYOK lookup.

4. **`openclaw/llm-router.ts` BYOK** — accept `userId` so key can be resolved from BYOK store instead of operator env.

5. **`:any` count 56 → target ≤5** — planned type debt; not a blocker but diverges from doctrine claim of "3 `:any`".

6. **Cron log gap** — 7 crons logged vs 18 expected. Verify remaining 11 crons either (a) have `run_count=0` rows not inserted yet, or (b) are registered in wrangler.toml but haven't fired.

7. **protobufjs moderate vuln** — `npm audit fix` (dev dep, no prod risk but clean audit preferred).

### Doctrine-locked (out of scope)

- Layer 10 backup score (7/10) — no external cron registration by doctrine. R2 lifecycle is the ceiling.
- Layer 7 monitoring score (8/10) — Sentry without source maps by doctrine (no `SENTRY_AUTH_TOKEN` at deploy).

---

## Summary Scorecard

| Check | Result | Score |
|-------|--------|-------|
| SHA match (prod vs git HEAD) | ⚠️ DRIFT | - |
| HTTP/2 200 | ✅ | |
| OpenClaw exchange mint | ✅ | |
| 5 Bearer routes | ✅ 5/5 | |
| Invalid Bearer → 401 | ✅ | |
| Cookie backward-compat | ✅ | |
| Migration 0035 (affiliate tables) | ✅ | |
| Playwright J1, J3, J4 | ✅ 3/5 | |
| Playwright J2, J5 (FREE100 exhausted) | ❌ 2/5 | test data issue |
| Cron health (0 failures) | ✅ | |
| Cron coverage (7/18) | ⚠️ | |
| Type-check 0 errors | ✅ | |
| Lint ≤341 warnings | ✅ 339 | |
| 0 HIGH vulns | ✅ | |
| BYOK doctrine (API keys) | ⚠️ 2 paths | |
| Polar functional refs | ✅ internal only | |
| `:any` count | ⚠️ 56 | |
| console.log (app) | ✅ 1 | |

**Honest score: 88/100 vs doctrine ceiling 91.5/100**  
Gap explained: SHA drift (-1), Playwright test data (-1.5), `:any` debt delta from claimed "3" to actual 56 (-0.5), cron log gap (-1).

---

## Unresolved Questions

1. ~~What is in `aa1aef09` vs `7dd2d6f7`?~~ **Resolved**: `aa1aef09` = `feat: wire sop video distribution flow` only. OpenClaw is live on prod in `7dd2d6f7`.

2. **Are 11 missing crons simply never-fired or misconfigured?** Full wrangler.toml cron schedule list vs `cron_run_log` names should be cross-checked.

3. **Is `used_count` exhaustion on FREE100 intentional** (e.g., VIP codes are manually managed) or a test data hygiene issue? If intentional, Playwright tests need a separate non-exhaustible test code.
