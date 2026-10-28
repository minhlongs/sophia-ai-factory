# Follow-up repair checklist — post-PR #63 (2026-10-28)

Branch: `arena/232f904d-sophia-ai-factory` (clean, based on `main` = `00edba0a`).
Session policy fixes ONE branch; isolation intent satisfied by clean tree + verified
no other worktrees. No new worktree (would require another branch → breaks session tracking).

## Owners / file scope (single PR, two atomic commits so rollback is per-fix)

### C1 — P0: verified-media enforcement at durable + publish boundary
Owner: integrator (this agent). Layer: `tree/affiliate/execution`.
Files:
- `src/tree/affiliate/execution/execution-contract.ts` — add exported pure
  `hasVerifiedMedia(artifact)`; reuse in `evaluateArtifactGate`, add to
  `evaluatePublishGate`.
- `src/tree/affiliate/execution/execution-repo.ts` — guard `recordVerifiedArtifact`
  with `hasVerifiedMedia` BEFORE any INSERT/transition.
- `src/tree/affiliate/execution/__tests__/execution-contract.test.ts` — publish gate
  rejects zero-byte / empty-checksum / missing-storageKey artifacts.
- `src/tree/affiliate/execution/__tests__/execution-repo.test.ts` — REAL D1-compatible
  SQLite: invalid artifact does NOT insert row and does NOT advance state.
Acceptance: a `VerifiedArtifact`-shaped object with `byteSize:0`/`checksumSha256:''`
can never mark a run `rendered` nor authorize `publish_queued`, at both the pure
contract and the DB write boundary. No mock-only persistence.

### C2 — P1: deploy-config drift (`--env health`)
Owner: integrator. Layer: CI config + scripts.
Files:
- `.github/workflows/deploy.yml` — remove 2 dead `--env health || true` calls;
  keep the 3 top-level secret puts fail-loud; document root cause.
- `apps/sophia-ai-factory/scripts/deploy-with-sha.sh` — remove matching dead
  non-fatal block (legacy fallback, same drift).
- `apps/sophia-ai-factory/scripts/__tests__/deploy-env-consistency.test.ts` — NEW:
  cross-check workflow + fallback scripts against `wrangler.toml` env declarations;
  assert no `--env <non-empty>` reference to an undeclared env, and no `|| true`
  on the 3 critical `secret put` commands. Test reads real files (no self-compare,
  no skipping the wrangler.toml dependency).
Acceptance: drift re-appearing (any `--env health` or any `--env NAME` not exposed
by wrangler config) fails CI Gate 1d. Critical secrets cannot be silently skipped.

### Explicitly NOT changed (scope discipline)
- `wrangler.toml` `[[env]]` array-of-tables → converting to `[env.health]` would
  ALTER the top-level worker's named-env topology (architectural decision + CF
  credentials needed to verify). Recorded as blocker with options instead.
- `handlePostbackRoute` tenant resolution (F3) — needs business decision.
- pricing/billing policy, protected flows (Setup Wizard / Telegram / NOWPayments IPN).

## Verification commands (exact package scripts / CI equivalents)
- `npx vitest run <targeted tests>` (boundary tests)
- `npm run type-check` — 0 errors (full program; may be heavy)
- `npm run lint` / `eslint <changed>` 
- `npm run check:boundaries`
- `npm run i18n:validate` (no copy change, still run for parity)
- `node scripts/check-production-source-guards.mjs`
- `node scripts/check-diff-coverage.mjs` with BASE_SHA
- PR required checks: Gate 1 (tsc/eslint/boundaries/vitest+coverage/diff-cov/
  source-guards/secret-grep), Gate 2, Gate 4.
- Post-merge: watch `deploy.yml` run for merge commit → Stage 1/2a/3a/3b/4,
  then HTTP `/api/version`, `/api/health`, `/login`, `/vi/login`.

## No-gos
No browser/headless/visual QA, no paid provider calls, no real content publish,
no manual remote migration, no direct-push main, no force-push, no bypass checks,
no emergency local deploy, no secret values in code/logs/tests/PR.
