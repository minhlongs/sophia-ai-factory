# Deployment Checklist: Sophia 2027 Slice 1 — Recon Refresh + Constitution v1.1 (docs-only)

> CF-direct doctrine (GitHub Actions DISABLED by design — CI sections replaced by local gates + wrangler).

## Meta

| Field | Value |
|-------|-------|
| Date | 2026-08-26 00:52 (+07) |
| Feature | docs(strategy): refresh 2027 recon + ratify constitution v1.1 |
| PR | none — direct-to-main (repo practice; CI disabled) |
| Commit SHA | 33d8b82d5ab3952d2cd2fa2315313101b30ccf08 (short 33d8b82d) |
| Deployer | git-manager (P5 ship agent) |

## Pre-Deploy Gates

### Code Quality (P4 evidence, same tree, 2026-08-25)
- [x] `npx tsc --noEmit` (app dir, 4GB heap) — exit 0, 0 errors
- [x] `npm test` — 7985 passed / 1 failed (pinned KNOWN-RED C1 `src/land/youtube/__tests__/actions.test.ts:322`, pre-existing, untouched) / 34 skipped / 10 todo
- [x] `npm run build` — exit 0
- [x] `npm run lint` — 11 err / 335 warn = exact baseline, zero new
- [x] No new `:any` types (tsc 0 errors)

### Branch
- [x] Committed direct to `main` (single commit, conventional)
- [x] Pushed to origin/main BEFORE deploy (deploy-with-sha.sh precondition)
- [x] Commit message carries `WARNING: deploying on known-broken base: pinned known-red C1 ...` (deploy-verify rule for known-broken base)

### Protected Flows
- [x] Setup Wizard — GET /vi/setup-wizard → 200 (pass)
- [x] Telegram Bot — GET /api/webhooks/telegram → 503 canary_window (pre-existing webhook version-pinning, see KNOWN-RED below; middleware live and enforcing)
- [x] NOWPayments webhook — GET /api/webhooks/nowpayments → 503 canary_window (same pre-existing mechanism)
- [x] Zero `src/` files in commit (verified: `git show --name-only` → 4 docs files only)

### Environment Variables
- [x] New env vars: None (docs-only slice)
- [x] No secrets committed; no `.env` in diff

## Deploy Execution (CF-direct)

- [x] Attempt 1 (`9f15e4ac`): aborted by deploy-with-sha.sh test gate — pinned C1 fails raw `npm test`
- [x] Amended commit with required WARNING line → `33d8b82d5`, force-push-with-lease (0/0 sync)
- [x] Attempt 2: `SKIP_TESTS=1 npm run deploy:full` → **exit 0** (sole bypass; tsc/signature/pre-deploy gates ran; precedent: journal 20260820-getd1-go-live)
- [x] wrangler deployed Worker `sophia-ai-factory`; secrets COMMIT_SHA/DEPLOYED_AT/DEPLOY_BRANCH uploaded
- [x] Sentry sourcemap upload skipped (SENTRY_AUTH_TOKEN unset — expected per no-tech doctrine)

## Post-Deploy Verification

- [x] Migrations: `git diff --name-only HEAD~1 HEAD -- migrations/` empty → none to apply
- [x] SHA match: /api/version shortSha `33d8b82d` == local HEAD `33d8b82d` (cache-busted probe)
- [x] /api/version deployedAt: 2026-08-25T17:52:10Z (updated), opennextVersion 1.19.11
- [x] /api/health → 200
- [x] /login → 307 → / → 200 (locale redirect chain, final 200)
- [x] /vi/login → 200
- [x] / → 307 (expected locale routing)
- [x] /vi/setup-wizard → 200
- [x] deploy-with-sha.sh internal post-deploy smoke: passed

## KNOWN-RED (pre-existing, documented, non-blocking per deploy-verify rule)

1. **Webhook probes return 503 `canary_window`** (telegram + nowpayments GET). Source: `src/middleware-api-handler.ts:19-32` — webhook version-pinning rejects unauthenticated probes with 503 + Retry-After:30 when INTERNAL_API_SECRET is configured. Introduced 2026-04-25 (`455bbd6d1`), ancestor of pre-deploy base `125c48e51` — pre-existing. Plan expected 4xx; actual designed behavior is structured 503 canary response (proves middleware live). Docs-only deploy cannot alter runtime middleware (zero src/ diff).
2. **Pinned C1** — `src/land/youtube/__tests__/actions.test.ts:322`, pre-existing known-broken base; bypassed via SKIP_TESTS=1 with WARNING in commit message.

## Rollback Readiness

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "<reason>" --yes
# docs-level revert: git revert 33d8b82d5 && npm run deploy:full
```
