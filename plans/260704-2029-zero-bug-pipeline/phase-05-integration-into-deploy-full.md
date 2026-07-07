---
phase: 5
title: "Integration into deploy:full"
status: complete
effort: "Wired into deploy-with-sha.sh Step 0.9"
---

# Phase 5: Integration into deploy:full

## Overview

Wires the zero-bug pre-deploy gate into the production deploy pipeline so it runs automatically before every deployment. Also adds a post-deploy smoke test that verifies the deployed code matches the local commit.

## Implementation

### Pre-Deploy Gate (Step 0.9 in deploy-with-sha.sh)

**File:** `apps/sophia-ai-factory/scripts/deploy-with-sha.sh`

The pre-deploy gate is injected at Step 0.9, after type-check and test gates but before the build:

```bash
if [ "${SKIP_PRE_DEPLOY_GATE:-0}" != "1" ]; then
  echo "==> pre-deploy gate validation"
  if ! node scripts/pre-deploy-gate.mjs; then
    echo "❌ Pre-deploy gate failed — aborting deploy"
    exit 1
  fi
  echo "✅ pre-deploy gate passed"
fi
```

**Gate sequence in deploy:full:**
1. Step 0.5 — TypeScript type-check (`npm run type-check`)
2. Step 0.6 — Vitest test suite (`npm test`)
3. Step 0.7 — GPG signature verification
4. **Step 0.9 — Zero-bug pre-deploy gate** (`node scripts/pre-deploy-gate.mjs`)
   - Route integrity scan
   - Page render check
   - CSS variable audit
5. Step 1 — Next.js production build
6. Step 3 — OpenNext Cloudflare build
7. Step 5.7 — Post-deploy smoke test (`node scripts/post-deploy-smoke.mjs`)

### Post-Deploy Smoke (Step 5.7 in deploy-with-sha.sh)

Runs after `wrangler deploy` completes:
- Checks `/api/health` returns HTTP 200
- Verifies `/api/version` `shortSha` matches `git rev-parse HEAD`
- Generates JSON evidence report
- Bypass: `SKIP_SMOKE_TEST=1`

### Optional Pre-Deploy E2E

Behind `RUN_PREDEPLOY_E2E=1` flag in Step 3b — runs Playwright against a staging preview before production deploy.

### Optional Post-Deploy E2E

Behind `RUN_POSTDEPLOY_E2E=1` flag in Step 6 — runs Playwright against production after deploy.

### NPM Script Links

```json
"pre-deploy:gate": "node scripts/pre-deploy-gate.mjs",
"deploy:full": "./scripts/deploy-with-sha.sh",
"deploy:verify": "node scripts/post-deploy-smoke.mjs"
```

## Success Criteria

- [x] Pre-deploy gate runs automatically in `npm run deploy:full`
- [x] Gate runs after type-check + tests, before build
- [x] Deploy aborts (exit 1) if any gate check fails
- [x] Post-deploy smoke runs after every successful deploy
- [x] SHA match verified between local commit and production `/api/version`
- [x] All bypass flags documented: `SKIP_PRE_DEPLOY_GATE=1`, `SKIP_SMOKE_TEST=1`, `RUN_PREDEPLOY_E2E=1`, `RUN_POSTDEPLOY_E2E=1`
