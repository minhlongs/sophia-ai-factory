# Deployment Checklist: Sophia 2027 Phase 1 Execution — Domain Primitives

> CF-direct doctrine (GitHub Actions DISABLED by design — CI sections replaced by local gates + wrangler).

## Meta

| Field | Value |
|-------|-------|
| Date | 2026-08-26 |
| Feature | Phase 1 domain primitives: identity/memory flywheel, approval loop closure, MarketSignal dedupe, content-graph tests |
| PR | none — direct-to-main (repo practice; CI disabled) |
| Commit range | `33d8b82d5..1df573d85` (6 conventional commits) |
| Head SHA | 1df573d85 (short 1df573d8) |
| Pipeline | /orchestrate PLAN GATE PASS R2 → EXECUTE A-E → RESULT GATE PASS R1 → SHIP |

## Pre-Deploy Gates

- [x] `npx tsc --noEmit` (app dir, 4GB heap) — exit 0
- [x] `npm test` — **8032 passed** (+47 new vs slice-1 baseline 7985) / 1 failed (pinned KNOWN-RED C1 `src/land/youtube/__tests__/actions.test.ts:322`, pre-existing, untouched) / 34 skipped / 10 todo
- [x] `npm run build` — exit 0
- [x] `npm run lint` — **11 err / 335 warn == frozen baseline exact** (verified via temp detached worktree at `33d8b82d`; transient +1 max-lines regression fixed pre-push by extracting `buildAgentMessages()` pure helper)
- [x] Zero new `:any` · zero new `console.*` · zero new eslint-disable
- [x] `git diff --stat` inspected — no accidental duplication, no stray files
- [x] Protected flows untouched (Setup Wizard BYOK / Telegram / NOWPayments — no diff under those paths)

## Branch & Commits

- [x] Direct to `main`, 6 bucketed conventional commits:
  1. `e5286617a` chore(ops): track slice-1 journal and planning artifacts
  2. `c18ccb8e4` refactor(domain): dedupe MarketSignal declaration
  3. `dcc25e2af` feat(agents): inject CreativeIdentity and persisted memory into agent runs
  4. `a5d247f56` test(content-graph): cover row mapping, errors, lineage and performance joins
  5. `513bfb7d4` feat(missions): emit agent.approval.resolved on approval resolution
  6. `1df573d85` docs: align stale claims with current code state
- [x] Pushed BEFORE deploy; final commit carries `WARNING: deploying on known-broken base (pinned C1 …)` per sophia-deploy-verify.md

## Environment Variables / Migrations

- [x] New env vars: none · No secrets committed
- [x] Migrations: none (zero-migration plan held — D1 schemas reused)

## Deploy Execution (CF-direct)

- [x] `SKIP_TESTS=1 npm run deploy:full` → **exit 0** (sole bypass on C1-broken base; WARNING line present)
- [x] Script internal checks: production HTTP `/api/health` → 200, `/login` → 200, post-deploy smoke passed
- [x] Sentry sourcemap upload skipped (SENTRY_AUTH_TOKEN unset — expected per no-tech doctrine)

## Post-Deploy Verification

- [x] SHA match: live `/api/version` shortSha **`1df573d8`** == local HEAD `1df573d85`
- [x] `/api/health` → 200 · `/login` → 200
- [x] Feature smoke: `/api/creative-identity` unauth → **401** (auth gate, not 500) · `/api/creative-memory` unauth → **401**
- [x] Webhook probes NOWPayments + Telegram GET → 503 `canary_window` = designed version-pinning (`455bbd6d1`) — expected, non-blocking

## Rollback Readiness

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "<reason>" --yes
# code-level revert: git revert 513bfb7d4 c18ccb8e4 dcc25e2af && npm run deploy:full
```

Trigger only if a feature smoke turns genuinely red post-canary; all smokes green at deploy time.
