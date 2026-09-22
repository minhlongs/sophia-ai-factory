# Sophia AI Factory — Deploy Verification (GitHub Actions CI/CD Doctrine)

> **AUTHORITATIVE for Sophia AI Factory deploy verification.**
> **OVERRIDE:** This rule governs all deployment operations and verifications across Sophia AI Factory.
> Subagents and operators MUST follow this rule before reporting GREEN on any deployment.

### Pre-Deploy Gate (MANDATORY)
Before pushing commits to `main` (which triggers automated deployment via `.github/workflows/deploy.yml`), the following quality gates MUST pass locally on the working tree:
1. `npm run type-check` — 0 TypeScript compilation errors
2. `npm run lint` — 0 ESLint errors
3. `bash scripts/check-layer-boundaries.sh` — 0 Clean Architecture layer violations
4. `npm run i18n:validate` — 0 missing translation keys
5. `npm run test` — all Vitest unit and integration tests passing

If deploying on a known-broken base (tracked issue), the commit message must carry: `WARNING: deploying on known-broken base: <issue-reference>`

## Stack Reality

- **Deploy target:** Cloudflare Workers (OpenNext build)
- **Canonical Deploy Pipeline:** GitHub Actions (`.github/workflows/deploy.yml`) on push to `main` or manual `workflow_dispatch`
- **Local deploy:** DISABLED by default to prevent environment drift and uncommitted drift.
- **Break-Glass Emergency:** Permitted only in critical CI outages via `EMERGENCY_CF_DIRECT=1 npm run deploy:full`.
- **Build artifact:** `.open-next/worker.js`
- **D1 Database:** `sophia-raas-db` (binding `DB`)
- **R2 Cache:** `sophia-ai-factory-opennext-cache` (binding `NEXT_INC_CACHE_R2_BUCKET`)
- **GitHub Actions Status:** ACTIVE & CANONICAL (`.github/workflows/deploy.yml`).

## Production URLs

```bash
PROD_URL="https://sophia.agencyos.network"
HEALTH_URL="https://sophia.agencyos.network/api/health"
VERSION_URL="https://sophia.agencyos.network/api/version"
```

## ✅ MANDATORY Verify Sequence (Post-Deploy)

```bash
# Step 1: Monitor GitHub Actions pipeline run
gh run watch || gh run list --workflow=deploy.yml

# Step 2: Verify bit-for-bit SHA match (CRITICAL — proves new code is live, not stale)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s "https://sophia.agencyos.network/api/version?deployVerify=$(date +%s)" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local commit SHA: $LOCAL_SHA  Live edge SHA: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOY MATCHES COMMIT" || { echo "❌ STALE — live edge does not match commit SHA"; exit 1; }

# Step 3: Production HTTP health checks
curl -s -o /dev/null -w "%{http_code}\n" https://sophia.agencyos.network/api/health  # must be 200
curl -s -o /dev/null -w "%{http_code}\n" https://sophia.agencyos.network/login        # must be 307 or 200
curl -s -o /dev/null -w "%{http_code}\n" https://sophia.agencyos.network/vi/login     # must be 200

# Step 4: Run automated post-deploy smoke suite
node scripts/post-deploy-smoke.mjs "https://sophia.agencyos.network" "$LOCAL_SHA"
```

**Endpoint reference:**
- `GET /api/version` — public: `{shortSha, deployedAt, opennextVersion}`. Primary deploy verify signal.
- `GET /api/health` — service health (auth required for full detail).
- `GET /login` — root auth router (redirects HTTP 307 to `/vi/login`).
- `GET /vi/login` — localized customer login portal (HTTP 200).

## ✅ Required Report Format

```markdown
## Verification Report — CI/CD Production Deploy
- Quality Gate: ✅ Stage 1 passed (type-check, lint, layer boundaries, i18n, vitest)
- CI/CD Run: ✅ GitHub Actions deploy.yml completed successfully
- Migrations: ✅ D1 delta migrations applied (sophia-raas-db)
- Edge Deploy: ✅ Cloudflare Workers deployed via opennextjs-cloudflare
- Live SHA Match: ✅ /api/version shortSha == <commit_short_sha> bit-for-bit
- Production Health: ✅ /api/health → 200, /login → 307, /vi/login → 200
- Deploy verified: <ISO timestamp>
```

**Sai dòng "Live SHA Match" = chưa verify deploy thực sự.**

## D1 Migration Application

D1 migrations are automatically calculated and applied in Stage 2 of the GitHub Actions pipeline:
```bash
# Automated in CI/CD:
bash scripts/apply-migrations.sh "$PREVIOUS_LIVE_SHA"

# Manual execution (if in break-glass emergency):
cd apps/sophia-ai-factory
bash scripts/apply-migrations.sh
```

## Rollback Procedure

```bash
# Rollback to previous Cloudflare Workers deployment
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Emergency rollback" --yes

# Or revert commit on main and push to trigger automated redeployment:
git revert HEAD -m 1
git push origin main
```

## ❌ Anti-Patterns

- ❌ Deploying directly from local workstation without `EMERGENCY_CF_DIRECT=1` break-glass flag
- ❌ Curl HTTP 200 without bit-for-bit SHA check against `/api/version`
- ❌ Reporting "Done" before live SHA match passes
- ❌ Pushing code to main that breaks pre-deploy quality gates (tsc, lint, layer boundaries, i18n, vitest)
- ❌ "Vercel auto-deployed" — project is Cloudflare Workers
