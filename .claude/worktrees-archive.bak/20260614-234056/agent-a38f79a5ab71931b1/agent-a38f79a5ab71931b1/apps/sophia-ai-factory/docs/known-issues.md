# Known Issues — Sophia AI Factory

> Living inventory of non-blocking defects + technical debt.
> Severity: **P0** blocker, **P1** high (next sprint), **P2** low (backlog).
> First populated: 2026-05-17 Phase 01 audit.

## Active

| Severity | Area | Symptom | Discovered | Source | Notes |
|---|---|---|---|---|---|
| ~~P1~~ ✅ | ~~Security: Auth brute-force~~ | F01 REMEDIATED 2026-05-18 | 2026-05-18 | Phase 05a + 06 | `0114-user-failed-logins.sql` + `src/seed/security/sql-rate-limiter.ts` + `src/seed/hooks/account-lockout-hook.ts`. Better Auth wiring TODO deferred to operator post-handover (non-blocking). 14 regression tests pass. ASVS V2.2.2 → Pass (pending wiring completion). |
| ~~P1~~ ✅ | ~~Security: Privilege escalation~~ | F02 REMEDIATED 2026-05-18 | 2026-05-18 | Phase 06 | `requireRecentAuth` + `/api/admin/admin-challenge/route.ts` + 5-min HMAC cookie. Applied to bulk-generate. 11 tests pass. ASVS V3.5.1 → Pass. |
| ~~P1~~ ✅ | ~~Security: IDOR~~ | F03 CLOSED-NOT-APPLICABLE 2026-05-18 | 2026-05-18 | Phase 05 | Single-tenant `promo_codes` table (no `agency_id`). Architecturally impossible to exploit. ASVS V4.3.1 → Pass. |
| P2 | Layer arch: tree/handover → forest | `tree/handover/auto-handover.ts` and `handover-email-service.ts` import `@/forest/outbox/email-outbox` and `@/forest/email/*` (tree→forest violation). Full move to `forest/handover/` requires updating ~20 app/land callers. ESLint-exempted. Fix in standalone sprint. | 2026-05-18 | Batch B M5 | files: `src/tree/handover/auto-handover.ts`, `src/tree/handover/handover-email-service.ts`. All 20 callers use `@/tree/handover/*` paths. |
| P2 | Layer arch: tree/telegram → forest | 5 telegram files import `@/forest/inngest/client` or `@/land/affiliates` (tree→forest/land violations). Full move to `forest/telegram/` requires updating ~14 callers. ESLint-exempted. Fix in standalone sprint. | 2026-05-18 | Batch B M6 | files: `dispatch-with-retry-hints.ts`, `telegram-bot-campaign-fsm*.ts`, `handlers/campaign-handler.ts`. |
| P2 | Layer arch: raas-service lowercase Tier | `forest/raas-service-types-and-constants.ts` defines `Tier = 'basic' \| 'premium' \| 'enterprise' \| 'master'` (lowercase) vs canonical UPPERCASE Tier in seed/types. Cannot change without migration path since license key wire format encodes lowercase tier strings (`LICENSE_KEY_PATTERN`). Fix: add boundary mapper + graduated migration. | 2026-05-18 | Batch B M7 | 5 callers in forest/raas-* + forest/components/admin/licenses/*. Deferred to avoid breaking encoded license keys. |
<!-- Phase 03b shipped 2026-05-18 — resolves 3 prior P1/P2 carryovers. See commit history. -->
| ~~P1~~ ✅ | ~~Bulk-generate idempotency~~ | RESOLVED Phase 03b: `Idempotency-Key` header → SHA-fingerprint check vs `admin_audit_log` 60s window → 409 with priorBatchId if duplicate. | 2026-05-18 | Phase 03b |
| ~~P1~~ ✅ | ~~Bulk-generate perf~~ | RESOLVED Phase 03b: single SELECT WHERE code IN (...) for collision + `db.batch()` chunks of 50 for INSERTs. N=1000 now ~chunks-of-50 round-trips (expected p95<3s). | 2026-05-18 | Phase 03b |
| ~~P2~~ ✅ | ~~Bulk-generate partial-write~~ | RESOLVED Phase 03b: switched to `db.batch()` chunk-atomicity. Each chunk of 50 INSERTs commits or rolls back atomically (D1 batch semantics). | 2026-05-18 | Phase 03b |
| P3 | CSV cell-injection | Description containing `=`, `+`, `@`, `-` chars may execute as formula when CSV opened in Excel. | 2026-05-18 | Phase 03 code review | Admin-only audience low-risk. Mitigation if needed: prefix risky cells with `'`. |
| P2 | API metadata | `OPENNEXT_VERSION` hardcoded `"1.17.3"` in `src/app/api/version/route.ts:33` while `package.json` declares `^1.19.5` | 2026-05-15 | memory | Cosmetic — `/api/version` shows stale version string. Fix: read from `package.json` at build time. |
| P2 | Staging NOWPayments placeholder | Staging Worker secrets use placeholders for NOWPayments (`STAGING-PLACEHOLDER-NO-LIVE-PAYMENT`) to prevent accidental real charges during pen test. Phase 06 payment pen test requires either (a) real NOWPayments sandbox key injection, OR (b) pen test scope reduction (skip payment flow). | 2026-05-18 Phase 02 | Phase 02 deployment | Mitigation: operator or pen tester must `wrangler secret put NOWPAYMENTS_API_KEY --config wrangler.staging.toml --name sophia-ai-factory-staging` with real sandbox credentials before Phase 06 payment tests, OR document payment tests as out-of-scope for staging. |
| P2 | Secrets hygiene | Stale `POLAR_*` secrets in CF Worker (`POLAR_API_KEY`, `POLAR_API_URL`, `POLAR_PRODUCT_{STARTER,GROWTH,PREMIUM,MASTER}`, `POLAR_WEBHOOK_SECRET`) | 2026-05-17 Phase 01 | `wrangler secret list` | Doctrine v1.28.1 rejects Polar.sh for Sophia. Should `wrangler secret delete POLAR_*` to reduce attack surface. Verify no code path references them first. |
| P2 | Test hygiene | 2 `vi.mock` nested calls (not top-level) — will become error in future Vitest | 2026-05-17 | `npm test` warnings | Files: `src/land/billing/email/__tests__/receipt-email.test.ts`, `src/forest/quota/__tests__/storage-tracker.test.ts`. Hoist `vi.mock(...)` to module top level. |
| P2 | Test hygiene | 4 k6 load-test files use anonymous default exports | 2026-05-17 | lint | Files: `tests/load/k6-{soak,spike,steady,stress}.js`. Add named function `export default function name() {}` per ESLint rule. |
| P3 | Coverage gap | Full authenticated browser smoke of 20 dashboard routes pending | 2026-05-17 Phase 01 | unauth-only curl baseline done | Curl-level smoke shows 307 protect / 200 public correct. Authenticated walk deferred to Phase 08 (Playwright E2E using salvaged `tests/e2e/go-live-user-gap.spec.ts`). |

## Cleared / Out-of-Scope

| Note | Reason |
|---|---|
| QStash external cron registration | Out-of-scope per Sophia no-tech doctrine v1.28.1. R2 lifecycle 30d = de-facto backup. |
| Sentry source map upload (symbolication) | Optional per doctrine. CF Worker logs are canonical real-time error stream. |
| DMARC graduation to `p=quarantine` | Operator discretion, not platform requirement. |

## Conventions

- Add new rows at top of "Active" table.
- Move to "Cleared / Out-of-Scope" when resolved or scoped-out by doctrine.
- Reference commit SHA when closing an item.
