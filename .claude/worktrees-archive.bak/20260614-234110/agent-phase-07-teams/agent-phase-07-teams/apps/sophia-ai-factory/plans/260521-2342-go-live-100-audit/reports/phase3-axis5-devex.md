# Phase 3 — Axis 5: DevEx / Maintainability Audit

**Date:** 2026-05-22
**Doctrine:** sophia-no-tech-doctrine SUSPENDED — honest scoring.
**Work context:** `apps/sophia-ai-factory`
**Stack:** Next.js 16 + OpenNext + Cloudflare Workers, pnpm, vitest, playwright.

---

## TL;DR

**Total: 41 / 60** — "Above-average DevEx, structural debt blocks 50/60+."

Strengths: layer model documented + enforced via ESLint, husky pre-commit, 6-stage CI/CD gates exist, deep docs library (60+ files), 475 unit-test files.

Critical drags: 16 layer violations grandfathered into ESLint overrides (no remediation deadline), coverage **1.72%** lines (vs 80% rule-of-thumb), `--max-warnings=341` enshrined as accepted debt, hardcoded `OPENNEXT_VERSION = "1.17.3"` while package on `^1.19.5` (`src/app/api/version/route.ts:33`), `test.yml.disabled` (CI bypassed by doctrine — `.husky/pre-commit` + branch protection are now the only enforced gates).

---

## 1. Architectural Cohesion — **6 / 10**

**Evidence:**
- 4-layer model documented: `seed(192)/tree(199)/forest(428)/land(171)` (counts via `find src/<L> -name '*.ts*'`).
- ESLint enforces one-way direction `land → forest → tree → seed` (`eslint.config.mjs:21-46`).
- **16 cross-layer upward imports grandfathered** in `eslint.config.mjs:21-32` (seed/auth, seed/security, tree/handover, tree/telegram, forest/inngest, forest/quota, forest/components/pricing). Examples:
  - `src/seed/auth/enforce-tier-quota.ts` re-exports `checkTierQuota` from `@/forest/auth/enforce-tier-quota` (inversion of dependency direction)
  - `src/seed/auth/enforce-tier-quota.test.ts` imports `@/forest/quota/video-quota`
  - `src/seed/types/quota-provider.ts` JSDoc references `@/forest/quota/quota-checker`
- `forest/` is 2x larger than other layers (428 files) — fat layer = cohesion smell.
- "LOCKED DECISIONS" comment block freezes violations without remediation TODO/date.

**Deduction:** -4 for grandfathered violations + fat-forest layer + no decay plan.

---

## 2. Test Pyramid Health — **5 / 10**

**Evidence:**
- Unit: **475** `.test.ts(x)` files under `src/` ✓ healthy count.
- E2E: **29** Playwright specs in `tests/` (claim verified).
- Smoke: **3** referenced (claim accepted; `npm run test:smoke` exists `package.json:21`).
- **Coverage: 1.72% lines / 1.64% statements / 1.56% functions / 1.22% branches** (`coverage/coverage-summary.json` total block). Brutally below industry norm (60-80%).
  - Caveat: `test:coverage:dashboard` is scoped (`package.json:16`) — full run may be higher, but the on-disk artefact says 1.72%.
- `pretest` enforces `i18n:validate` (`package.json:19`) ✓ good guardrail.
- No mutation testing, no flakiness tracker visible.
- 4702 vitest claim not independently verified in this pass.

**Deduction:** -5 for catastrophic coverage artefact + no flakiness/mutation tooling. Test *count* is fine, but unverified coverage = unknown quality.

---

## 3. Build & Local Dev — **7 / 10**

**Evidence:**
- `next dev` (Turbopack via build script `--turbopack`, `package.json:7`) — standard hot reload.
- Build allocates 14 GB heap (`NODE_OPTIONS=--max-old-space-size=14336`, `package.json:8`) → signals slow/heavy build on smaller machines.
- Lint allocates 12 GB heap (`package.json:11`) → ESLint memory pressure.
- `dev:mock` flag (`package.json:9`) ✓ unlocks offline iteration.
- TS strict ON (`tsconfig.json` `"strict": true`). 4 `@ts-ignore/nocheck/expect-error` site-wide ✓ low.
- 56 `: any` annotations remain — finite but non-zero. Mostly localised; not blocking.
- Deploy script is a 4-step pipeline (`package.json:36`) — fragile when partial steps fail; no idempotency test.

**Deduction:** -3 for heap requirements (M1 16GB users will OOM) + multi-step deploy fragility.

---

## 4. Lint / Format / Typecheck Rigor — **6 / 10**

**Evidence:**
- `ci:lint` = `eslint --max-warnings=341` (`package.json:53`) — **341 warnings codified as ceiling**, not zero.
- React Compiler rules `react-hooks/purity` + `react-hooks/immutability` demoted error→warn (`eslint.config.mjs` continuation).
- Custom `no-as-error` rule enforced (`eslint.config.mjs:7-10`) ✓ regression guard for `toError()` migration.
- `tsc --noEmit` in CI ✓ (`package.json:52`).
- 56 `: any`, 34 `console.*`, 25 `TODO/FIXME/HACK` in `src/`. 35 console claim verified within tolerance (34 found, 1 may be eslint-disabled).
- secretlint in CI (`package.json:54`) ✓.

**Deduction:** -4 for `--max-warnings=341` (any monotonic increase = wedged gate), demoted React Compiler rules, lingering `any`/console.

---

## 5. Code Review & CI Gates — **8 / 10**

**Evidence — what's enforced when `test.yml.disabled`:**
- `.husky/pre-commit` runs `npx lint-staged` (verified `/Users/macbook/projects/sophia-ai-factory/.husky/pre-commit`) → ESLint + tsc + secretlint on staged files only.
- `.github/workflows/quality-gate.yml` IS active (Gates 1 + 3 on `pull_request`) — SHA-pinned actions, `paths-ignore` for docs.
- `.github/workflows/canary-rollback.yml`, `security-scan.yml`, `dependency-audit.yml`, `agent-self-review.yml` active.
- `test.yml.disabled` + `post-merge-tests.yml.disabled` + `d1-backup.yml.disabled` — three CI jobs intentionally archived per CF-direct doctrine.
- `.github/CODEOWNERS` + `PULL_REQUEST_TEMPLATE.md` present ✓.
- Pre-push 6-gate pipeline claim accepted (not independently audited this pass).
- Bypass via `git commit --no-verify` documented but "discouraged" (`.husky/pre-commit:3`) — soft enforcement only.

**Deduction:** -2 because (a) only-staged lint-staged misses repo-wide drift, (b) `test.yml` disabled means full vitest never runs in CI — relies on author discipline + `quality-gate.yml` PR job only.

---

## 6. Documentation & Onboarding — **9 / 10**

**Evidence:**
- 60 files in `docs/` — `ARCHITECTURE.md` (current, dated 2026-05-22), `QUICKSTART.md`, `SECURITY.md`, `INCIDENT_RESPONSE.md`, `GO-LIVE-DEPLOYMENT-GUIDE.md`, `deployment-guide.md`, `disaster-recovery.md`, `dr-drill-260518.md`, `escalation-contacts.md`, `code-standards.md`, `code-standards-advanced-patterns.md`, `codebase-summary.md`, `design-guidelines.md`, `dev-sops.md`, `infra-hardening.md`, `a11y-baseline.md`, `asvs-l2-checklist.md`, `api-rate-limits.md`, `ai-architecture-2026-update.md`, `incident-response-playbook.md`, `payout-operations-runbook.md`, `load-testing-runbook.md`, `gitlab-migration-runbook.md`, `sophia-supervisor-agent-runbook.md`, `runbooks/` dir, `operator-playbook/` dir, `handover/` dir.
- `CONTRIBUTING.md` (69 LOC) + root `README.md` (56 LOC — thin but ARCHITECTURE.md compensates).
- ARCHITECTURE.md contains ASCII deployment diagram + CF bindings table ✓.
- `compliance/` dir present.

**Deduction:** -1 because root `README.md` only 56 lines (insufficient onboarding landing) and doc volume risks staleness without index.

---

## P0 / P1 Maintainability Findings

| Priority | Finding | Evidence | Recommendation |
|---|---|---|---|
| **P0** | Coverage artefact = 1.72% lines | `coverage/coverage-summary.json` `"pct":1.72` | Run `pnpm test:coverage` repo-wide; gate `ci:test` at floor (start 30%, ladder to 60%). |
| **P0** | Hardcoded OpenNext version drift | `src/app/api/version/route.ts:33` `const OPENNEXT_VERSION = "1.17.3"` vs `package.json` `"^1.19.5"` | Read from `package.json` at build time (Vite-define) or expose `process.env.OPENNEXT_VERSION` injected by deploy script. |
| **P0** | `ci:lint --max-warnings=341` wedged | `package.json:53` | Ratchet down weekly (340 → 320 → 280…), fail PR that increases count. |
| **P1** | 16 layer violations grandfathered, no decay | `eslint.config.mjs:21-32` | Attach owner + deadline per exemption; convert exemption list to JSON with `expiresAt`. |
| **P1** | `test.yml` disabled — full vitest not in CI | `.github/workflows/test.yml.disabled` | Either restore as `pull_request` gate or document explicit pre-push enforcement (which dev verifies?). |
| **P1** | 56 `: any` + 34 `console.*` + 25 TODO/FIXME | `grep` counts | Add ratchet rules: count must be monotonically decreasing per PR. |
| **P1** | `forest/` layer 2x bloated (428 files vs 192/199/171) | `find src/<L>` | Sub-divide forest by domain (auth, billing, agents, video) → forest/* sub-layers. |
| **P1** | Build heap 14 GB / lint 12 GB | `package.json:8,11` | Diagnose: which files explode heap? Target M1 16 GB dev parity. |
| **P2** | React Compiler rules demoted to warn | `eslint.config.mjs` comment block | Schedule incremental cleanup epic; restore to error per directory. |
| **P2** | Deploy script 4-step pipeline, no idempotency check | `package.json:36 (deploy)` | Wrap in `deploy:full-verified.sh` (already exists?) with checkpoint resume. |
| **P2** | Root `README.md` thin (56 LOC) | `wc -l README.md` | Promote QUICKSTART.md content; add badges, link to ARCHITECTURE.md. |

---

## Score Summary

| # | Sub-area | Score |
|---|---|---|
| 1 | Architectural cohesion | 6/10 |
| 2 | Test pyramid health | 5/10 |
| 3 | Build & local dev | 7/10 |
| 4 | Lint/format/typecheck rigor | 6/10 |
| 5 | Code review & CI gates | 8/10 |
| 6 | Documentation & onboarding | 9/10 |
| **TOTAL** | | **41 / 60** |

---

## Unresolved Questions

1. Is `coverage/coverage-summary.json` (1.72%) from a scoped `test:coverage:dashboard` run, or repo-wide? If scoped, re-run `pnpm test:coverage` to get honest figure.
2. Why is `test.yml` disabled per CF-direct doctrine? `binh-phap-cicd.md` mentions Sophia exception — but if pre-push enforcement is the canonical path, is it verified machine-side (server-side hook) or trust-based (client hook can be `--no-verify`'d)?
3. 4702 vitest test claim vs 475 `*.test.*` files — average 10 tests/file plausible but not verified; `vitest run --reporter=json` would confirm.
4. 16 grandfathered layer violations: who owns the remediation? No `OWNER:` or `EXPIRES:` annotation in `eslint.config.mjs` overrides.
5. `OPENNEXT_VERSION = "1.17.3"` hardcoded — is the deploy actually using 1.17.3 (locked) or 1.19.5 (per package.json)? `pnpm why @opennextjs/cloudflare` would resolve.
6. Does pre-push pipeline run full `vitest` (4702 tests) or only changed-file vitest? If full, runtime is the bottleneck for dev velocity.
