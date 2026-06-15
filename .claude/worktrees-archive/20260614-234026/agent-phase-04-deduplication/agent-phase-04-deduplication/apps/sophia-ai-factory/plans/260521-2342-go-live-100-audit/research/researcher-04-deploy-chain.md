# R4: Deploy Chain Mapping — Sophia CF-direct Doctrine

**Author:** Researcher 04  
**Date:** 2026-05-21  
**Scope:** End-to-end CF-direct deployment via `npm run deploy:full`

---

## Deploy DAG (Directed Acyclic Graph)

```
┌─────────────────────────────────────────────────────────┐
│  npm run deploy:full (apps/sophia-ai-factory/)         │
│  Entry: scripts/deploy-with-sha.sh                      │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
    ┌────▼──────────────┐    ┌──────▼──────────┐
    │ Step 0: Precond   │    │ Step 1-2: Build │
    │ • Push check      │    │ • Next.js build │
    │ • HEAD == origin/ │    │ • OpenNext      │
    │ • Dirty tree OK?  │    │ • Scheduled inj │
    └────┬──────────────┘    └──────┬──────────┘
         │                          │
         └──────────────┬───────────┘
                        │
              ┌─────────▼─────────┐
              │ Step 3: Secrets   │
              │ via wrangler CLI  │
              │ (retry 3x w/ BX)  │
              │ • COMMIT_SHA      │
              │ • DEPLOYED_AT     │
              │ • DEPLOY_BRANCH   │
              └─────────┬─────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
    │ E2E Pre │   │ CF Deploy  │  │ E2E Post│
    │ (opt)   │   │ (wrangler) │  │ (opt)   │
    │ :3000   │   │ .open-next │  │ :prod   │
    └────┬────┘   │ /worker.js │  └────┬────┘
         │        └─────┬──────┘       │
         │              │              │
         └──────────────┼──────────────┘
                        │
            ┌───────────▼───────────┐
            │ Step 5: Sentry maps   │
            │ (non-fatal, optional) │
            │ CI script             │
            └───────────┬───────────┘
                        │
            ┌───────────▼───────────┐
            │ ✅ Deploy complete    │
            │ Verify: curl /api/ver │
            │ SHA must match HEAD   │
            └───────────────────────┘

POST-DEPLOY (manual, canonical):
    npm run deploy:migrations   → apply D1 migrations
    npm run deploy:verify       → sophia-doctor health check
```

---

## Guard Rails Inventory (CF-direct Doctrine 2026-05-03)

| Gate | Layer | Command | Bypass | Notes |
|------|-------|---------|--------|-------|
| **G0.push** | Script L66-92 | `git log origin/main..HEAD` | `ALLOW_UNPUSHED_DEPLOY=1` | Prevents prod/git divergence (incident 2026-05-13/15) |
| **G0.dirty** | Script L84 | `git diff-index --quiet HEAD` | (none) | Rejects uncommitted changes — index refresh required |
| **G1.typecheck** | Pre-push L18-19 | `npm run ci:typecheck` (tsc) | `--no-verify` | Fails fast on TS errors (caption-translator.test.ts incident 2026-05-17) |
| **G2.lint** | Pre-push L28-29 | `eslint --max-warnings=341` | `--no-verify` | FAIL mode since 2026-05-13 (no new warnings) |
| **G3.test** | Pre-push L31-32 | `vitest run` + dashboard coverage | `--no-verify` | 844+ tests; contract tests in G3 |
| **G4.secrets** | Pre-push L41-42 | `secretlint` full src tree | `--no-verify` | Catches missed keys; complements commit-time lint-staged |
| **G5.audit** | Pre-push L44-45 | `npm audit --audit-level=high` | `--no-verify` (WARN only) | Non-blocking (SOP 9 says defer; 3 transitive HIGH vulns) |
| **G0.5.rebuild** | Script L108-113 | `npm run type-check` external | (gate fails) | Replaces `ignoreBuildErrors: true` — TS must pass before next build |
| **G3b.e2e-pre** | Script L146-153 | Playwright @smoke vs :3000 | `RUN_PREDEPLOY_E2E=0` (default) | Optional Track C; requires running local dev server |
| **G4.secrets.cf** | Script L137-139 | wrangler secret put (retry 3x) | (gate fails) | Transient CF API failures (502 BX) → exponential backoff |
| **G6.e2e-post** | Script L188-197 | Playwright @smoke vs prod | `RUN_POSTDEPLOY_E2E=0` (default) | Asserts deploy matches `SOPHIA_EXPECTED_SHA` |

**Empirical reliability (Phase 02 DV-2):** Pre-push hook + deploy-with-sha.sh combined: 5/5 successful deploys.

---

## SHA Injection Flow (Current → Desired)

### Current (2026-05-21)
| Component | Value | Source | Issue |
|-----------|-------|--------|-------|
| **Local HEAD** | `d68b4d96` | `git rev-parse HEAD` | ✅ |
| **/api/version shortSha** | `b8c4f6dd` | COMMIT_SHA env var (prod) | ❌ Hardcoded `"1.17.3"` opennextVersion (defect) |
| **Live at prod?** | YES (20h ago) | `curl -s https://sophia.agencyos.network/api/version` | ✅ |
| **OPENNEXT_VERSION** | `"1.17.3"` | src/app/api/version/route.ts:33 | ⚠️ Baked at build time, not from env |

### Build-Time Injection (deploy-with-sha.sh L94-102)
```bash
COMMIT_SHA=$(git rev-parse HEAD)           # → 40-char full SHA
COMMIT_SHORT=$(echo $COMMIT_SHA | cut -c1-8)  # → 8-char short
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ") # → ISO8601 UTC
DEPLOY_BRANCH=$(git rev-parse --abbrev-ref HEAD) # → branch name
```

### Runtime Injection (deploy-with-sha.sh L136-139)
```bash
echo $COMMIT_SHA | npx wrangler secret put COMMIT_SHA
echo $DEPLOYED_AT | npx wrangler secret put DEPLOYED_AT
echo $DEPLOY_BRANCH | npx wrangler secret put DEPLOY_BRANCH
```

### Reader (src/app/api/version/route.ts L35-44, 61-62)
```typescript
const ctx = (request as NextRequest & { env?: CloudflareEnv }).env;
return {
  COMMIT_SHA: ctx?.COMMIT_SHA ?? process.env.COMMIT_SHA,
  // ...
};
// ... response includes shortSha from COMMIT_SHA slice(0, 8)
```

**Defect found:** `OPENNEXT_VERSION` hardcoded at L33, never read from env. Should be injected as secret or baked from package.json. **Flagged for Phase 04.**

---

## D1 Migrations Application

**Automatic:** None. No Cloudflare workflow triggers migration apply.

**Manual (canonical):**
```bash
# After deploy:full (if migrations/ changed):
npm run deploy:migrations
# → bash scripts/apply-migrations.sh HEAD~1
# → git diff --relative HEAD~1 HEAD migrations/ *.sql
# → for each .sql: wrangler d1 execute sophia-raas-db --file=$m --remote
```

**Script assumes:**
- Working directory: `apps/sophia-ai-factory/`
- Git ref exists (defaults HEAD~1)
- wrangler auth present (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)

**Current state (2026-05-21):** 120 local migration files (0001–0120); applied count unknown (requires live `wrangler d1 migrations list`).

---

## Failure Recovery: Rollback Procedure

| Scenario | Steps | Time |
|----------|-------|------|
| **Deploy script failed** | 1. Diagnose error (stderr often names issue: TS error, secret put BX, wrangler auth) 2. Fix root cause (commit if needed) 3. Re-run `npm run deploy:full` | ~5-10min |
| **Secrets put failed mid-deploy** | 1. Re-run step 3 (wrangler secret put) with retry script 2. Verify via `npm run deploy:verify` 3. HTTP check | ~2min |
| **Deploy succeeded but smoke failed** | 1. Assess failure type (regression detected by Playwright) 2. Rollback: `npx wrangler rollback --message "<reason>" --yes` 3. Re-deploy prior commit if needed | ~3min |
| **Stale deploy detected (SHA mismatch)** | 1. Check `/api/version` shortSha 2. If ≠ local HEAD: re-run `npm run deploy:full` (may need `--config wrangler.toml` passed explicitly) | ~5-10min |

**Rollback command:**
```bash
npx wrangler rollback --name sophia-ai-factory --message "reason" --yes
```

**Or redeploy specific commit:**
```bash
git checkout <sha>
npm run deploy:full
git checkout main
```

---

## Environment Parity Matrix

| Aspect | Local (:3000) | Preview* | Production |
|--------|-------------|----------|------------|
| **Build engine** | Next.js dev (webpack) | (N/A) | Turbopack + OpenNext |
| **Database** | SQLite/.env.local | (wrangler preview D1) | D1 sophia-raas-db |
| **R2 buckets** | (none) | (wrangler preview) | 3 live (opennext-cache, videos, backups) |
| **Auth secret** | BETTER_AUTH_SECRET env | (from wrangler) | CF secret |
| **AI services** | NEXT_PUBLIC_MOCK=1 (dev) | Real keys (dev env) | Customer BYOK |
| **Webhook IPN** | (localdev via ngrok) | (localdev via ngrok) | Prod NOWPayments webhook |
| **Crons** | (disabled) | (disabled) | 18 CF Worker crons active |

*Preview = `wrangler dev` or `wrangler preview` (not fully deployed).

**Risk:** Local dev bypasses many CF-specific bindings (KV, R2 lifecycle, D1 tag cache). Smoke tests must run against staging or prod to catch binding issues.

---

## Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Unpushed commit shipped to prod** | Low (G0.push gate) | Critical — prod/git divergence | Deploy gate checks `git log origin/main..HEAD` (2026-05-15) |
| **TS errors silent in build** | Low (G0.5 gate) | High — broken runtime | Pre-build `npm run type-check` (added 2026-05-17) |
| **Secrets put 502 transient failure** | Med | High — partial state (some secrets set, deploy incomplete) | Retry 3x w/ exponential backoff (5s, 10s, 20s) |
| **Stale deploy (deploy succeeded, old code live)** | Low (verified post-deploy) | High — users on outdated version | SHA check mandatory: `curl /api/version` shortSha must match HEAD |
| **Migrations not applied** | Med | Med — schema drift, queries fail | Manual `npm run deploy:migrations` required; no auto-trigger |
| **E2E smoke timeout or flake** | Med | Low (post-deploy, optional) | Smoke only blocks if `RUN_POSTDEPLOY_E2E=1` (disabled by default) |
| **Cron handler missing from injection** | Low | Med — cron silently no-ops | `scripts/inject-scheduled-handler.mjs` maps wrangler.toml crons → API routes |

---

## Open Questions

1. **How is `OPENNEXT_VERSION` kept in sync with `package.json`?** Currently hardcoded; should version bump in OpenNext trigger a rebuild? (flagged for Phase 04)
2. **Why 120 migrations locally but applied count unknown?** Need live `wrangler d1 migrations list sophia-raas-db` to confirm all are applied to remote D1.
3. **Are post-deploy smoke tests part of SOP?** Currently optional (`RUN_POSTDEPLOY_E2E=0` default). Should they be mandatory before marking "deploy complete"?
4. **Cron reconciliation:** wrangler.toml lists 18 crons; are all 18 routes live in `src/app/api/cron/*`? `inject-scheduled-handler.mjs` maps them — need audit.

---

**Status:** ✅ DONE. Report filed for Phase 01 synthesis.
