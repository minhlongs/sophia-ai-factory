# Verification evidence

**Date:** 2026-10-28 (Asia/Ho_Chi_Minh) · **Branch:** `arena/0c751328-sophia-ai-factory`
**Working directory for all commands:** `apps/sophia-ai-factory`
**Policy:** no browser, no headless browser, no screenshot, no real provider, no remote migration,
no paid traffic, no production data. Browser-based checks were **not run and not disabled**; any
required browser check means this PR is **not ready to merge**.

## 0. Environment (reproducibility)

```
node v22.22.3 · npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund \
  --registry=https://registry.npmjs.org --replace-registry-host=always
```

`--ignore-scripts` was required because `better-sqlite3`'s native build needs nodejs.org headers,
which this sandbox cannot reach. Consequence: five **pre-existing** test files that instantiate
`better-sqlite3` directly cannot run locally (see §5). `src/seed/testing/fake-d1-sqlite.ts` was
made portable — prefer `better-sqlite3`, fall back to Node 22 built-in `node:sqlite` — so all new
DB-boundary tests still exercise real SQL, UNIQUE indexes, `ON CONFLICT`, CAS updates and CHECK
constraints rather than a mock database. GitHub's `quality-gate.yml` uses `npm install
--legacy-peer-deps` (scripts enabled), where the native module builds normally.

## 1. Exact repository checks

| # | Command (exact) | Result | Notes |
| --- | --- | --- | --- |
| 1 | `npm run i18n:validate` | **PASS** | 5,398 `t()` calls, 2,395 unique static keys, 42 dynamic prefixes, **0 missing / 0 unresolved**. Also runs automatically as `pretest`. |
| 2 | `npm run check:boundaries` | **PASS** | "All layer boundaries clean (both static and dynamic imports verified)". |
| 3 | `node scripts/check-production-source-guards.mjs` | **PASS** | no explicit `:any`, no prohibited production `console`. |
| 4 | `eslint src --max-warnings=525` (CI `ci:lint`; `npm run lint` is the same with a larger heap) | **PASS** | **0 errors, 212 warnings** (all pre-existing `sonarjs/cognitive-complexity` / unused-var warnings), under the 525 gate. |
| 5 | `npx tsc --noEmit` (`npm run type-check` / CI Gate 1a) | **NOT VERIFIED locally in one process** | Plain `tsc --noEmit` OOMs in this 4 GB sandbox (exit 137 at 3.3 GB heap). Workaround that **does** fit: generate a temporary `tsconfig.opc.json` with `extends: ./tsconfig.json`, `files: [ALL 3,900 src/**/*.ts(x) files + src/seed/auth/jwt-nonce-kv.ts]`, `include: []`, `incremental: false`, then `NODE_OPTIONS=--max-old-space-size=3000 tsc --noEmit -p tsconfig.opc.json`. Result after the fixes below: **0 real errors** (only 24 local `TS2307 Cannot find module 'node:sqlite'` caused by this sandbox's `@types/node`; CI's `npm install` resolves it). The helper config is deleted before commit; CI full `tsc` is authoritative. |
| 6 | `vitest run --reporter=dot --maxWorkers=2` (full suite) | **PARTIAL** | 1,984 files: **1,977 passed / 6 failed / 1 skipped**; 18,774 tests: **18,661 passed / 69 failed / 34 skipped / 10 todo**. Five failing files are the pre-existing native-binding issue (§5); the sixth was a stale copy assertion in `affiliates/__tests__/page.test.tsx`, which was updated to the new honest UI and now passes. |
| 7 | `npm test -- --coverage --maxWorkers=2 --reporter=dot` (CI Gate 1d shape) + `node scripts/check-diff-coverage.mjs` | see §6 | Coverage run executes the full suite with instrumentation; the diff-coverage gate requires ≥70 % of changed executable lines and branches. |
| 8 | `npm run build` (`next build`) | see §6 | Not part of `quality-gate.yml`; attempted separately where the sandbox allowed. |
| 9 | `npm run test:e2e` (Playwright) / any browser check | **NOT RUN — NOT DISABLED** | Forbidden by mandate. Visual / responsive / real render = **NOT VERIFIED**. |

## 2. Migration upgrade at the DB boundary

`migrations/0482_opc_affiliate_execution_truth.sql` is applied to a fresh SQLite DB that already has
`0206_commission_events.sql`, **twice**, via `createFakeD1` (real SQL, not mocks).

```
npx vitest run src/tree/affiliate/execution/__tests__/execution-repo.test.ts \
               src/land/affiliates/__tests__/domain-b-ledger-invariants.test.ts \
               src/land/affiliates/postbacks/__tests__/saas-crypto-postback-service.test.ts \
               src/forest/inngest/functions/__tests__/flywheel-feedback-dispatcher.test.ts \
               src/tree/affiliate/offers/__tests__/offer-eligibility.test.ts
→ 6 files / 38 tests PASSED
```

Proven: all 8 tables (`commission_events`, `workspace_external_commissions`,
`agent_campaign_approvals`, `opc_postback_events`, `affiliate_execution_runs`,
`affiliate_media_artifacts`, `opc_feedback_events`, `opc_bandit_arms`) exist; migration rerunnable;
direct INSERT with `platform_fee_cents = 25` **rejected by CHECK**; duplicate `beginExecutionRun`
returns the same row without resetting state; two concurrent `recordVerifiedArtifact` calls yield
exactly one artifact row; tenant A cannot read/transition tenant B's run and the same idempotency
key creates a distinct run in tenant B; a run without verified media stays `render_queued`.

## 3. Required scenario coverage (≥ 8, at real boundaries)

| # | Scenario | Test file (boundary) | Result |
| --- | --- | --- | --- |
| 1 | SaaS VI/EN happy path with connected IDs | `niche-video-dispatcher.test.ts` (registered Inngest handler) + `execution-repo.test.ts` (D1) | PASS — `RENDER_QUEUED`, `runId`, `idempotencyKey`, `offerId`, `tenantId` all propagated |
| 2 | CEX verified vs unknown jurisdiction / terms | `offer-eligibility.test.ts`, `sourced-claims.test.ts`, `niche-video-dispatcher.test.ts` | PASS — `JURISDICTION_UNKNOWN`, `OFFER_TERMS_UNKNOWN`, `VIETNAM_PROMOTIONAL_BAN`; no invented bonus |
| 3 | Failure / replay / restart | `execution-repo.test.ts`, `auto-video-mission-proof.test.ts`, `domain-b-ledger-invariants.test.ts` | PASS — replay no-op, CAS state, typed skip/error, restart does not reset state |
| 4 | Payload changed after approval | `execution-contract.test.ts`, `niche-video-dispatcher.test.ts`, `opc-affiliate-e2e-orchestration.test.ts` | PASS — `APPROVAL_INVALIDATED`, no spend |
| 5 | Tenant A / tenant B | `execution-repo.test.ts`, `offer-eligibility.test.ts`, `domain-b-ledger-invariants.test.ts` | PASS — same provider event id processed independently; namespaced `commission_events` |
| 6 | High CTR with negative contribution / immature or unknown window | `auto-campaign-scaler.test.ts`, `kelly-allocator.test.ts`, `predictive-render-actions.test.ts` | PASS — `MAINTAIN_STEADY`, 0 Kelly allocation, no immature winner |
| 7 | Feedback persisted exactly once and influences the next seeded decision | `flywheel-feedback-dispatcher.test.ts`, `route-registration.test.ts`, `bandit-traffic-worker.test.ts` | PASS — replay `applied:false`; posterior not doubled; fixtures refused; worker `NOT_AVAILABLE` |
| 8 | Recurring / partial refund / reversal / out-of-order / multi-currency | `domain-b-ledger-invariants.test.ts`, `saas-crypto-postback-service.test.ts`, `workspace-domain-b-reconciliation.test.ts` | PASS — reversal after paid wins, `#adj:` history retained, `totalsAvailable:false` for mixed currency |
| 9 | Dashboard load-state honesty | `dashboard-load-state.test.ts`, `page.test.tsx`, `affiliate-cockpit-service.test.ts` | PASS — error ≠ zero, unknown kill switch ≠ off, per-currency display |
| 10 | Landing / nav / CTA honesty + VI/EN parity | `landing-honesty.test.ts`, `opc-primary-nav.test.tsx`, `npm run i18n:validate` | PASS — exact headlines, illustrative preview, real routes, 16 deep links, Refer Sophia separate |

## 4. Targeted runs executed during implementation

| Command | Result |
| --- | --- |
| `npx vitest run src/tree/affiliate/execution/__tests__ src/tree/affiliate/offers/__tests__` | 14 + 8 PASS |
| `npx vitest run src/forest/inngest/functions/__tests__/niche-video-dispatcher.test.ts` | 8 PASS |
| `npx vitest run <5 reconciliation/postback/cockpit/e2e files>` | 21 PASS |
| `npx vitest run src/land/missions/__tests__/auto-video-mission*.test.ts` | 15 PASS |
| `npx vitest run <kelly / predictive / scaler / flow tests>` | PASS |
| `npx vitest run <flywheel + route-registration + bandit tests>` | 9 PASS (4 feedback + 5 registration/bandit) |
| `npx vitest run <nav + landing + dashboard-state + page tests>` | PASS |

## 5. Known local-only failures (not caused by this diff)

Five test files fail **only** because `better-sqlite3`'s compiled `.node` binding is absent in this
sandbox (`Could not locate the bindings file`):

- `src/app/api/v1/harness/__tests__/route.test.ts`
- `src/forest/pipeline/__tests__/checkpoint-service.test.ts`
- `src/land/publish/__tests__/publishing-jobs-unique.test.ts`
- `src/tree/distribution/__tests__/types.test.ts`
- `src/tree/roi/__tests__/tracker.test.ts`

The most recent successful upstream `Quality Gate` run (`40450677586`, `main` PR, 18m44s) shows
Gate 1 all green on GitHub-hosted runners with the native module built. These files were **not**
modified by this diff (except the unrelated `page.test.tsx`, which was fixed). No browser checks
were substituted for them.

## 6. Coverage / build / CI

**Full-suite coverage run:** `npm test -- --coverage --maxWorkers=2 --reporter=dot` completed in
1,385 s — 1,984 files (**1,978 passed / 5 failed / 1 skipped**), 18,774 tests
(**18,663 passed / 67 failed / 34 skipped / 10 todo**). The five failures are the native-binding
issue in §5. That run did **not** leave a usable `coverage/lcov.info` in this sandbox (the
instrumented merge step was killed while the 4 GB environment was under load), so the diff-coverage
gate was evaluated with a **conservative subset** instead.

**Diff-coverage gate (lower bound):** `npx vitest run <21 changed/new test files + 5 related
existing suites> --coverage --reporter=dot` followed by `node scripts/check-diff-coverage.mjs`
(result: **PASS**):

```
Changed executable lines: 394/462 (85.28%)
Changed branches:         487/658 (74.01%)
PASS: changed-line and changed-branch coverage meet 70% thresholds
```

Because the full suite executes strictly more tests than the subset, real CI coverage cannot be
lower than this figure. `quality-gate.yml` Gate 3a is therefore expected to pass; the authoritative
verdict is the PR's GitHub Actions run.

**`npm run build`** (`next build`, Turbopack) was attempted with
`NODE_OPTIONS=--max-old-space-size=3500`: it reached "Creating an optimized production build ..."
and was **killed (exit 137, OOM)** in this 4 GB sandbox. Result: **NOT VERIFIED locally**. Build is
not a step in `quality-gate.yml`; scoped `tsc` (0 errors), ESLint (0 errors), boundaries, i18n and
the full vitest suite are the PR gates.

**GitHub issue / PR workflow:** issue **#62** was created for this work. The requested
`ready to cook → in progress` label transition could **not** be applied: both `gh issue edit
--add-label` and `gh api -X POST .../issues/62/labels` return
`403 Resource not accessible by integration` (the Arena GitHub App token can create issues but
cannot modify labels). This is a permission limitation, not a skipped step; issue #62 is currently
**unlabelled**. `ak-vibe`'s `/review-pr --fix --reply` and `/ship` do not exist in this checkout
(see `plan.md`), so PR review was performed as a read-only independent `git diff` pass plus
`gh pr` checks instead.

**Authoritative CI:** see the PR's `Quality Gate (Gates 1 + 3)`, `Security Scan (Gate 2)` and
`Dependency (Gate 4)` runs via `gh run list` / `gh pr checks`. Results observed during this session
are recorded in §8 below and in the PR conversation.

## 8. CI iteration (first run → fixes)

PR #63 first CI run (`40582716246` Gate 1, `40582716134` Gate 2, `40582716182` Gate 4):

| Gate | First result | Cause | Fix |
| --- | --- | --- | --- |
| Gate 1a `tsc --noEmit` | FAIL (4 errors) | Four object literals in the **unchanged** `affiliate-cockpit-service.test.ts` lacked the new `contributionCents` / `costKnown` (`ScalingDecision`) and `adjustmentCents` (`DomainBCurrencySummary`) fields. The local scoped tsc only included changed files, so it could not see these downstream consumers. | Fixture fields added; a wider scoped program over **2,374 files that reference changed modules** was then run → 0 real errors (only 9 local `node:sqlite` type-resolution errors caused by this sandbox's `@types/node`). |
| Gate 2a `npm audit --audit-level=high --omit=dev` | FAIL | Newly published advisory `GHSA-44jh-23m7-hpcf` (critical) covering `better-auth 1.3.8-beta.3 – 1.7.6` via `@better-auth/drizzle-adapter` / `@better-auth/kysely-adapter`. `package-lock.json` was untouched by this branch; earlier security runs on 2026-10-27 04:36 passed before the advisory appeared. | Minimal in-range security bump `better-auth ^1.6.14 → ^1.7.14` (installed 1.6.29 → 1.7.14). `npm audit --audit-level=high --omit=dev` now returns **0 vulnerabilities**; 36 auth/session/middleware tests still pass; wider scoped tsc still clean. No framework/provider/billing change. |
| Gate 4 dependency | PASS | — | — |
| Gate 1b–1d, 3a–3c | not reached (Gate 1a aborted the job) | — | re-run after the fixes |

Second CI run (`40584197853` / `40584197740` / `40584197732`): Gate 2 **PASS**, Gate 4 **PASS**,
Gate 1a still FAIL — `better-auth` 1.7 models `twoFactor.enable()` as a discriminated union, so
`res.data.totpURI` in `settings-security-section.tsx` no longer type-checks (2 errors). Fixed by
narrowing on `'totpURI' in data` with an explicit honest fallback notice. A full **src-only**
scoped tsc program (3,900 files, see row 5) then reported 0 real errors. No file outside `src`
imports any changed module, so this program covers every downstream consumer of this diff.

The `node:sqlite` TS2307 errors are local-only: CI's `npm install --legacy-peer-deps` resolves a
`@types/node` that declares `node:sqlite`, while this sandbox's `--ignore-scripts` install does not.

The `ready to cook → in progress` label issue and the missing `ak-vibe` skill remain as recorded in
`plan.md`.

## 7. What is explicitly NOT verified

- **Visual / responsive / accessibility in a real browser** — NOT VERIFIED (mandate forbids browsers).
  Component-level semantics (roles, `data-testid`, labels, keyboard-reachable elements) are tested;
  actual rendering is not.
- **Real provider correctness** — BLOCKED: no ElevenLabs/render/publish/analytics credentials, no
  paid calls, no real posts, no real affiliate network webhooks. Fixtures are labelled `isFixture`.
- **Remote migration on Cloudflare D1** — not run. Only D1-compatible local SQLite (migration
  chain 0206 → 0482, applied twice).
- **Commercial validation** — no profit/earnings claim, no traffic purchase, no payout execution.
- **Full `tsc --noEmit` and `next build` in this sandbox** — memory-limited; scoped tsc is green,
  CI full tsc is authoritative.
- **Telegram entrypoint** — event contract was extended but the Telegram path was not re-tested.
- **Real auth session + real D1 binding end-to-end** — only server-action unit boundaries and local
  fixtures.

**Conclusion of evidence:** source/math correctness and local integration fixtures are verified.
Real-provider correctness and commercial validation are not. This is not a production-ready or
revenue claim.
