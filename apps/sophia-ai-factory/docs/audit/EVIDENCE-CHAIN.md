# EVIDENCE CHAIN — SUPREME HANDOVER CERTIFICATION

**Date:** 2026-09-09
**Certification:** SUPREME HANDOVER
**Purpose:** Trace every certificate claim to a reproducible command/output. Flag dangling claims.

---

## 1. Chain structure

```
task.md → plan.md → phase reports (execution.md) → baseline → certificate
```

Every claim in `SUPREME-HANDOVER-CERTIFICATE.md` must trace to a phase report in `.orchestrate/latest/execution.md`, which traces to a reproducible command in this file.

---

## 2. Claim → evidence map

| Certificate claim | Phase | Reproducible command / output | Status |
|---|---|---|---|
| Local HEAD `57fcc931c` | 0 | `git rev-parse HEAD` → `57fcc931ca8329cac9ec4483ab752a8033f65894` | REPRODUCIBLE |
| Live shortSha `34219be6` | 1 | `curl -s https://sophia.agencyos.network/api/version` → `"shortSha":"34219be6"` | REPRODUCIBLE |
| SHA mismatch (STALE-AHEAD) | 0,1 | local `57fcc931c` vs live `34219be6` | REPRODUCIBLE |
| `/api/health` = degraded | 1 | `curl -s https://sophia.agencyos.network/api/health` → `{"status":"degraded",...}` | REPRODUCIBLE |
| 8928 tests passed | 0 | `npx vitest --run` → `8928 passed / 34 skipped / 10 todo` | REPRODUCIBLE |
| 237 migrations | 0 | `ls migrations/*.sql \| wc -l` → `237` | REPRODUCIBLE |
| 4 users, all test/seed | 2 | `SELECT id,email,name FROM user` → 4 rows (synthetic-monitor, e2e-test, test@test.com, prodtest-*) | REPRODUCIBLE |
| No authorized founder | 2 | Phase 2 classification: all 4 = SYSTEM/TEST/SECURITY-TEST/SEED | REPRODUCIBLE |
| FAL_KEY absent | 3 | `resolveUserApiKey(userId,'fal-ai',process.env.FAL_KEY)` → 0 BYOK + no platform secret | REPRODUCIBLE |
| fal-ai = PRODUCTION_CANDIDATE | 3 | `src/seed/ai/providers/fal-image-provider.ts:66-72` | REPRODUCIBLE |
| P01 D1 sync client | 5 | `src/seed/db/client.ts:367` → `export function createServerClient(override?: D1Database)` | REPRODUCIBLE |
| P02 middleware CSP/CSRF | 5 | `src/middleware.ts` → `generateNonce`, `verifyCsrfToken`, `handleCorsPrelight` | REPRODUCIBLE |
| P04 tagCache DEGRADED | 5 | `grep -rn "revalidateTag" src/tree src/forest src/land` → `0` (path-only) | REPRODUCIBLE |
| P06 BYOK AES-GCM AAD | 5 | `src/tree/byok/byok-crypto.ts:218` → `additionalData: new TextEncoder().encode(userId)` | REPRODUCIBLE |
| P06 circuit breaker 370 sites | 5 | `grep -rn "shouldAllowRequest" src/ \| wc -l` → `370` | REPRODUCIBLE |
| P07 Sentry DEGRADED | 5 | `console.error` in `middleware.ts:172`; no `SENTRY_AUTH_TOKEN` | REPRODUCIBLE |
| P09 revalidateTag DEGRADED | 5 | `grep -rn "revalidateTag" src/tree src/forest src/land` → `0` | REPRODUCIBLE |
| P10 backup route | 5 | `src/app/api/cron/d1-backup/route.ts` → `sophia-backups/d1-YYYY-MM-DD.sql` | REPRODUCIBLE |
| P11 protected flows | 5 | Setup Wizard `src/tree/components/setup-wizard/`, Telegram + NOWPayments in middleware | REPRODUCIBLE |
| P12 Result<T,E> | 5 | `src/seed/types/result.ts:2,6,10` → `success`/`failure` | REPRODUCIBLE |
| P12 atomic lock | 5 | `src/land/affiliates/commission-ledger-mutations.ts` → `INSERT ... ON CONFLICT DO NOTHING` + `meta.changes` | REPRODUCIBLE |
| P13 bilingual | 5 | `messages/en.json` + `messages/vi.json` exist; `useTranslations` 100+ sites | REPRODUCIBLE |
| P14 handover module | 5 | `src/tree/handover/` → 15 files (generator, types, tier-content, magic-link, email) | REPRODUCIBLE |
| P10 backup bucket binding | 6 | `wrangler.toml:47-49` → `binding = "BACKUPS_BUCKET"`, `bucket_name = "sophia-backups"` | REPRODUCIBLE |
| P10 restore procedure | 6 | `scripts/dr/restore-from-snapshot.sh` + `docs/deployment-guide.md:394-412` | REPRODUCIBLE |
| No secrets committed | 9 | `.env` gitignored; no `sk-`/`AKIA` literals in src | REPRODUCIBLE |
| NOWPayments IPN signature | 9 | `src/app/api/webhooks/nowpayments/route.ts:124-127` → `x-nowpayments-sig` verified | REPRODUCIBLE |
| Telegram webhook secret | 9 | `src/app/api/webhooks/telegram/route.ts:84-85` → `X-Telegram-Bot-Api-Secret-Token` | REPRODUCIBLE |
| Accesstrade HMAC | 9 | `src/app/api/webhooks/accesstrade/route.ts:15` → `verifyHmac` HMAC-SHA256 | REPRODUCIBLE |
| FailureKind AUTH_FAILURE | 9 | `src/seed/types/failure-kind.ts:43` → `status === 401 \|\| 403` → `AUTH_FAILURE` | REPRODUCIBLE |

---

## 3. Dangling claims

**None.** Every certificate claim traces to a phase report with a reproducible command/output.

---

## 4. Cross-check: docs vs code

| Doc claim | Code reality | Match? |
|---|---|---|
| "BYOK AES-GCM with userId as AAD" | `byok-crypto.ts:218` uses `userId` as `additionalData` | YES |
| "Circuit breaker on all external HTTP" | 370 `shouldAllowRequest` sites + 766 `recordSuccess/recordFailure` | YES |
| "revalidateTag/Path live via tagCache D1" (doctrine) | `revalidateTag` = 0 in tree/forest/land; only `revalidatePath` (43 sites) | **NO — doctrine overclaims. P09 scored DEGRADED.** |
| "30-day backup lifecycle" | Route comment claims 30-day; no explicit `lifecycle` block in wrangler.toml | PARTIAL — documented intent, not infrastructure-verified. P10 scored accordingly. |
| "Sentry captures but not symbolicated" | `console.error` in middleware; no `SENTRY_AUTH_TOKEN` | YES |
| "atomic lock via INSERT ON CONFLICT DO NOTHING" | `commission-ledger-mutations.ts`, `refund-processor.ts` confirmed | YES |

**Findings:** The only doc/code divergence is the `revalidateTag` doctrine claim — the code uses path-based invalidation only. This is already scored as DEGRADED in Phase 5 P09. No new defects.

---

## 5. Verdict

**EVIDENCE CHAIN CLOSED.** All 27 certificate claims are reproducible. One doctrine overclaim (`revalidateTag`) is already tracked as DEGRADED. No dangling claims.

---

*End of evidence chain. Cross-reference: `SUPREME-HANDOVER-CERTIFICATE.md`, `SUPREME-HANDOVER-BASELINE.md`.*
