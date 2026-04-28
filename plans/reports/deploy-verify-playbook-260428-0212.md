# Deploy Verify Playbook — Phase 3

**Created:** 2026-04-28 02:12 PT
**Target:** Cloudflare Workers production deploy verify per `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

## Pre-Push Checklist

- [x] Build green: `npm run build` exit 0
- [x] Tests green: 1582/1582 pass + 31 skipped
- [x] Migration `0024-videos.sql` written
- [x] No secrets committed

## Required Cloudflare Secrets (9)

Set via `wrangler secret put <NAME>` or GitHub Actions repo secrets:

| Secret | Used By | Source |
|--------|---------|--------|
| `HEYGEN_API_KEY` | `/api/heygen/*` | HeyGen account |
| `ELEVENLABS_API_KEY` | TTS service | ElevenLabs account |
| `OPENROUTER_API_KEY` | Script generator fallback | OpenRouter account |
| `NOWPAYMENTS_API_KEY` | Crypto checkout | NOWPayments dashboard |
| `NOWPAYMENTS_IPN_SECRET` | Webhook signature | NOWPayments dashboard |
| `TELEGRAM_BOT_TOKEN` | @Sophia_Bbot | BotFather |
| `INNGEST_EVENT_KEY` | Job queue | Inngest dashboard |
| `INNGEST_SIGNING_KEY` | Job queue auth | Inngest dashboard |
| `CLICKBANK_INS_SECRET` | Webhook auth | ClickBank dashboard |
| `CRON_SECRET` | Internal cron auth | Generate fresh |

## D1 Migrations to Apply (remote)

```bash
# Apply 0018 → 0024 to remote D1
for m in 0018 0019 0020 0021 0022 0023 0024; do
  npx wrangler d1 execute sophia-raas-db --remote \
    --file=apps/sophia-ai-factory/migrations/${m}-*.sql
done
```

## Verify Sequence (after `git push origin main`)

```bash
# 1. Tests & Deploy run for current commit
COMMIT_SHA=$(git rev-parse HEAD)
RUN_ID=$(gh run list --commit "$COMMIT_SHA" --workflow "Tests & Deploy" \
  --json databaseId -q '.[0].databaseId')

# 2. Poll until complete (~5-8 min for build+deploy)
gh run watch "$RUN_ID" --exit-status

# 3. Verify BOTH jobs succeeded
gh run view "$RUN_ID" --json jobs -q '.jobs[] | "\(.name): \(.conclusion)"'
# Expect:
#   Lint & Build & Test: success
#   Deploy to Cloudflare Workers: success

# 4. HTTP probe
curl -sI https://sophia.agencyos.network | head -3   # HTTP/2 200

# 5. CRITICAL: Deploy SHA matches commit
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version \
  | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ MATCH" || echo "❌ STALE"
```

## Post-Deploy Smoke Tests

```bash
# Auth-protected endpoints — expect 401 (not 500/404)
curl -s -o /dev/null -w "%{http_code}\n" https://sophia.agencyos.network/api/videos
# 401

curl -s -o /dev/null -w "%{http_code}\n" https://sophia.agencyos.network/api/scripts/generate -X POST
# 401

# Public endpoints
curl -s https://sophia.agencyos.network/api/version
# {"shortSha":"...","deployedAt":"...","opennextVersion":"..."}
```

## Rollback (if regression)

```bash
npx wrangler rollback --name sophia-ai-factory \
  --message "Phase 3 regression — rolling to <prev_sha>" --yes
```

## Status

- **Code-side:** ✅ ready (build + tests green, migration drafted)
- **Operational:** ⏸ user-action required:
  1. Confirm GitHub Actions enabled at repo level (was disabled per Sprint M changelog)
  2. Configure 9 Cloudflare Secrets above
  3. Apply migrations 0018-0024 to remote D1
  4. `git push origin main` → run verify sequence above

## Open Questions

- Whether Sprint M changelog "Actions disabled" comment is still current (workflows now show `active`).
- Whether D1 migrations 0018-0023 already applied to remote (need `wrangler d1 migrations list sophia-raas-db --remote`).
