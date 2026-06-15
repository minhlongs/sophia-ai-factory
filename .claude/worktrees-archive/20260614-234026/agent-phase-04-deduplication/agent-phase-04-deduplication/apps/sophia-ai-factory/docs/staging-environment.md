# Staging Environment

> **DO NOT USE FOR REAL CUSTOMER DATA.**
> Staging is a scratch environment for pen tests, load tests, DR drills, and E2E verification.
> All data may be wiped at any time.

Created: 2026-05-17 (Phase 02 of `plans/260517-2223-sophia-free100-handover/`)

---

## Endpoints

| What | Value |
|---|---|
| Staging URL | `https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev` |
| Worker name | `sophia-ai-factory-staging` |
| Health | `<staging>/api/health` |
| Version | `<staging>/api/version` |
| CF account | `f691e83094f776311a1bfe3f8b126f1c` (Billwill.mentor@gmail.com) |
| Workers.dev subdomain | `agencyos-openclaw` |

## Resources

| Resource | Name | ID |
|---|---|---|
| App D1 | `sophia-raas-db-staging` | `bf74b301-7bb4-441f-9960-c96244b82953` |
| Tag-cache D1 | `sophia-tag-cache-staging` | `46da1446-adb4-4afc-8514-8a9daa63b92f` |
| OpenNext cache R2 | `sophia-staging-cache` | n/a |
| Video R2 | `sophia-videos-staging` | n/a (empty) |
| KV (shared PROD, read-only A/B) | `EXPERIMENT_KV` | `c3857792e4014334ba31b62b19d2f32a` |
| Backups R2 | **NOT BOUND** (staging skips backups) |

## Deltas vs PROD

- Worker name swapped (`-staging` suffix).
- D1 instances are **separate** (no PROD data).
- R2 cache + video buckets are **separate**.
- `BACKUPS_BUCKET` binding **removed** (no cron in staging).
- All `[triggers].crons` **removed**.
- KV (`EXPERIMENT_KV`) **shared with PROD** — read-only A/B variants safe to share.
- `[vars] ENVIRONMENT = "staging"` added.
- No custom domain; uses `.workers.dev` subdomain.

## Deploy

```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
npm run deploy:staging
# or
bash scripts/deploy-staging.sh
```

The script:
1. Builds Next.js + OpenNext.
2. Sets `COMMIT_SHA`, `DEPLOYED_AT`, `DEPLOY_BRANCH` as staging secrets.
3. `wrangler deploy --config wrangler.staging.toml`.
4. Prints staging URL + verify command.

Staging is **more permissive** than PROD — unpushed commits are allowed by default. To enforce PROD-style push-precondition on staging, set `STAGING_REQUIRE_PUSH=1`.

## Verify

```bash
STAGING="https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev"
LOCAL_SHA=$(git -C /Users/macbook/projects/sophia-ai-factory rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s "$STAGING/api/version" | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ STAGING DEPLOY MATCHES COMMIT" || echo "❌ STALE"
curl -sI "$STAGING" | head -3   # HTTP 200
```

## Secrets to set (one-time)

These must be set BEFORE first deploy. The deploy script writes 3 auto-secrets (COMMIT_SHA/DEPLOYED_AT/DEPLOY_BRANCH). The rest are user-provided:

```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory

# Critical for the worker to boot:
npx wrangler secret put BETTER_AUTH_SECRET    --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put JWT_SECRET             --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put CRON_SECRET            --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put API_ENCRYPTION_KEY     --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put BYOK_MASTER_KEY        --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put CREDENTIALS_MASTER_KEY --config wrangler.staging.toml --name sophia-ai-factory-staging

# Payment (USE SANDBOX KEYS — staging must not produce real charges):
npx wrangler secret put NOWPAYMENTS_API_KEY    --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put NOWPAYMENTS_IPN_SECRET --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put NOWPAYMENTS_WALLET     --config wrangler.staging.toml --name sophia-ai-factory-staging

# Optional (Worker boots without these but features degrade):
npx wrangler secret put ANTHROPIC_API_KEY      --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put RESEND_API_KEY         --config wrangler.staging.toml --name sophia-ai-factory-staging
npx wrangler secret put INTERNAL_API_SECRET    --config wrangler.staging.toml --name sophia-ai-factory-staging
```

## Secret rotation

If a staging secret leaks or expires:
1. Generate new value in source.
2. `npx wrangler secret put NAME --config wrangler.staging.toml --name sophia-ai-factory-staging` (paste new value).
3. Worker reload is automatic on next request.
4. Document rotation in `docs/project-changelog.md`.

## Tear-down (when no longer needed)

```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
npx wrangler delete --config wrangler.staging.toml
npx wrangler d1 delete sophia-raas-db-staging
npx wrangler d1 delete sophia-tag-cache-staging
npx wrangler r2 bucket delete sophia-staging-cache
npx wrangler r2 bucket delete sophia-videos-staging
# Then commit removal of wrangler.staging.toml + scripts/deploy-staging.sh
```

## Doctrine compliance

- Doctrine v1.28.1 (no-tech) — staging exists for internal verification, not customer onboarding. No operator third-party setup beyond CF + NOWPayments sandbox.
- Sentry, observability, etc. are NOT wired on staging (doctrine: optional even on PROD).
