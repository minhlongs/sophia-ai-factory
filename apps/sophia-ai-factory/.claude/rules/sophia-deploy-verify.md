# Sophia AI Factory — Deploy Verification (CF-direct doctrine)

> **AUTHORITATIVE for Sophia AI Factory deploy verification.**
> Override bất kỳ generic rule nào khác. Subagents (đặc biệt git-manager) PHẢI đọc file này trước khi báo cáo GREEN.

## Stack Reality

- **Deploy target:** Cloudflare Workers (OpenNext build)
- **Deploy command:** `npm run deploy:full` (local wrangler CLI — NOT via GitHub Actions)
- **Deploy prerequisite:** `E2E_TEST_USER_PASSWORD` exported in operator shell/CI secrets
- **Deploy verification:** `deploy:full` deploys first, then runs go-live user E2E and cache-busted SHA/HTTP verification against the newly live Worker
- **Build artifact:** `.open-next/worker.js`
- **D1 Database:** `sophia-raas-db` (binding `DB`)
- **R2 Cache:** `sophia-ai-factory-opennext-cache` (binding `NEXT_INC_CACHE_R2_BUCKET`)
- **GitHub Actions:** DISABLED by design (`.github/workflows/test.yml.disabled`). Do NOT poll `gh run list`.

## Production URLs

```
PROD_URL="https://sophia.agencyos.network"
HEALTH_URL="https://sophia.agencyos.network/api/health"
VERSION_URL="https://sophia.agencyos.network/api/version"
```

## ✅ MANDATORY Verify Sequence (sau npm run deploy:full)

```bash
# Step 0: Confirm production E2E credential exists before deploy
test -n "$E2E_TEST_USER_PASSWORD" || {
  echo "❌ Missing E2E_TEST_USER_PASSWORD — bootstrap production E2E user first"
  exit 1
}

# Step 1: Confirm deploy:full script exited 0
# deploy:full runs:
#   1. scripts/deploy-with-sha.sh
#   2. npm run test:e2e:go-live against https://sophia.agencyos.network
#   3. scripts/verify-production-deploy.sh for cache-busted SHA match + HTTP 200
# If deploy, go-live user E2E, SHA match, or HTTP verification printed an error → STOP, do not report GREEN

# Step 2: Apply any new D1 migrations (if migrations/ changed in this commit)
git diff --name-only HEAD~1 HEAD apps/sophia-ai-factory/migrations/ 2>/dev/null | grep -E "\.sql$"
# If output is non-empty → run:
cd apps/sophia-ai-factory && bash scripts/apply-migrations.sh

# Step 3: Verify SHA match (CRITICAL — proves new code is live, not stale)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s "https://sophia.agencyos.network/api/version?deployVerify=$LOCAL_SHA" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOY MATCHES COMMIT" || { echo "❌ STALE — wrangler may not have deployed latest; re-run deploy:full"; exit 1; }

# Step 4: HTTP health check
curl -sI https://sophia.agencyos.network | head -3   # must see HTTP/2 200
```

**Endpoint reference:**
- `GET /api/version?deployVerify=<shortSha>` — public: `{shortSha, deployedAt, opennextVersion}`. Primary deploy verify signal; query string bypasses stale edge cache keys.
- `GET /api/health` — service health (auth required for full detail).

## ✅ Required Report Format

```
## Verification Report — Phase XX
- Build: ✅ exit code 0
- Tests: ✅ 1398/1398 passed
- Deploy: ✅ npm run deploy:full → wrangler deployed (CF-direct)
- Go-live E2E: ✅ production user auth/dashboard/video/account/billing passed
- Migrations: ✅ none new | ✅ <N> applied via apply-migrations.sh
- Production HTTP: ✅ 200 (https://sophia.agencyos.network)
- Deploy SHA Match: ✅ /api/version shortSha == <local_short_sha>
- Deploy verified: <ISO timestamp>
```

**Sai dòng "Deploy SHA Match" = chưa verify deploy thực sự.**

## Migration Application

```bash
# Apply migrations changed since last commit (default: HEAD~1 vs HEAD)
cd apps/sophia-ai-factory
bash scripts/apply-migrations.sh

# Apply since specific ref
bash scripts/apply-migrations.sh HEAD~3

# Manual single migration
npx wrangler d1 execute sophia-raas-db --file=migrations/<NNNN_name>.sql --remote
```

## Rollback

```bash
# Rollback to previous Cloudflare Workers version
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "<reason>" --yes

# Or redeploy a specific git commit:
git checkout <sha>
export E2E_TEST_USER_PASSWORD='<production-e2e-user-password>'
npm run deploy:full
git checkout main
```

## ❌ Anti-Patterns

- ❌ Polling `gh run list` — GitHub Actions is disabled; will always return 0 results
- ❌ Curl HTTP 200 without SHA check — may be stale deploy from prior wrangler invocation
- ❌ Reporting "Done" before step 3 (SHA match) passes
- ❌ Reporting "CI/CD GREEN" — there is no CI; use "Deploy: ✅ CF-direct" instead
- ❌ "Vercel auto-deployed" — project is Cloudflare Workers

## Historical Note

GitHub Actions `Tests & Deploy` workflow was operational until 2026-05-03 when the
`longtho638-jpg` account had Actions disabled (free-tier exhaustion). Five manual wrangler
deploys were made before the team adopted CF-direct as the permanent canonical doctrine:
`d84f3a6e`, `e53c7dd2`, `aafd1ba4`, `0520585b`, `f418f3df`.

Workflow file archived at `.github/workflows/test.yml.disabled`. Re-enable by renaming back to `.yml`.
