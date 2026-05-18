# Known Issues — Sophia AI Factory

> Living inventory of non-blocking defects + technical debt.
> Severity: **P0** blocker, **P1** high (next sprint), **P2** low (backlog).
> First populated: 2026-05-17 Phase 01 audit.

## Active

| Severity | Area | Symptom | Discovered | Source | Notes |
|---|---|---|---|---|---|
| P1 | Bulk-generate idempotency | `POST /api/admin/promo-codes/bulk-generate` does not honor `Idempotency-Key` header (spec NFR line 37). Double-submit produces 2 distinct batches. | 2026-05-18 | Phase 03 code review | Blast radius bounded by 5/hr rate-limit + admin-only. Fix in Phase 03b: KV-backed (or D1) dedup with 60s window. |
| P1 | Bulk-generate perf | Sequential loop at N=1000 — ~10s observed-estimate vs spec NFR `p95<3s`. Each iteration: 1 indexed SELECT + 1 INSERT. | 2026-05-18 | Phase 03 code review | Fix in Phase 03b: batched IN-clause collision check + `db.batch()` INSERTs in chunks of 50. |
| P2 | Bulk-generate partial-write | D1 JS API has no multi-statement transaction. If `createCode` fails at row k/N (k<N), prior rows persist as `active` without audit_log row. | 2026-05-18 | Phase 03 code review | Documented in `bulk-generator.ts` JSDoc. Recovery: operator query `promo_codes WHERE metadata->>'batchId' = ?` + bulk-disable. Long-term fix: `db.batch()` chunks (Phase 03b). |
| P3 | CSV cell-injection | Description containing `=`, `+`, `@`, `-` chars may execute as formula when CSV opened in Excel. | 2026-05-18 | Phase 03 code review | Admin-only audience low-risk. Mitigation if needed: prefix risky cells with `'`. |
| P2 | API metadata | `OPENNEXT_VERSION` hardcoded `"1.17.3"` in `src/app/api/version/route.ts:33` while `package.json` declares `^1.19.5` | 2026-05-15 | memory | Cosmetic — `/api/version` shows stale version string. Fix: read from `package.json` at build time. |
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
