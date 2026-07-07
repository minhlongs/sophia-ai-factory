# Operator Runbook — Solo Company Media

> **Mục đích / Purpose:**
> VN: Hướng dẫn vận hành hàng ngày cho Solo Company Media (operator).
> EN: Daily operations guide for Solo Company Media (platform operator).

## Deploy to Production

```bash
# Step 0: Push first (deploy-with-sha.sh rejects unpushed commits)
git push origin main

# Step 1: Build + deploy
cd apps/sophia-ai-factory
npm run deploy:full

# Step 2: Verify SHA match
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOY MATCHES" || { echo "❌ STALE"; exit 1; }

# Step 3: HTTP health check
curl -sI https://sophia.agencyos.network | head -3  # must see HTTP/2 200
```

**Deploy time:** ~5 min. See `.claude/rules/sophia-deploy-verify.md` for full sequence.

---

## Backup (D1 Database)

```bash
# Manual trigger (ad-hoc — no external cron registered per no-tech doctrine)
cd apps/sophia-ai-factory
bash scripts/apply-migrations.sh  # apply new migrations first

# D1 dump to local file
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT * FROM sqlite_master WHERE type='table'"

# Or use the built-in backup route (requires CRON_SECRET)
curl -s -H "Authorization: Bearer $CRON_SECRET" https://sophia.agencyos.network/api/cron/d1-backup
```

**Retention:** R2 lifecycle policy auto-deletes snapshots after 30 days.

### Restore from Backup

```bash
# List available backups
npx wrangler r2 object list sophia-ai-factory-backups --prefix backups/

# Restore specific dump
npx wrangler d1 execute sophia-raas-db --remote --file=migrations/<NNNN_name>.sql
```

---

## Monitoring

### Cloudflare Workers Logs (Real-Time)
```bash
cd apps/sophia-ai-factory
npx wrangler tail --format pretty
```

### Sentry Dashboard
- URL: [Sentry Dashboard](https://sophia-ai-factory.sentry.io) (requires auth)
- SDK captures errors with minified stack traces (source maps uploaded via R2 on deploy)
- If Sentry not capturing: verify `sentry.client.config.ts` + `sentry.server.config.ts` initialized

### Key Health Endpoints
| Endpoint | Purpose | Auth |
|----------|---------|------|
| `/api/version` | Deploy SHA match | Public |
| `/api/health` | Service health | Auth for full detail |
| `/api/admin` (dashboard) | Revenue + customer data | Admin only |

---

## Secrets Rotation

```bash
# Rotate any CF secret
cd apps/sophia-ai-factory
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put NOWPAYMENTS_API_KEY
npx wrangler secret put NOWPAYMENTS_IPN_SECRET
npx wrangler secret put RESEND_API_KEY
```

**Note:** Customer BYOK keys (OpenRouter, ElevenLabs, D-ID, HeyGen) are encrypted per-user — NOT operator secrets.

---

## Rollback

```bash
# Rollback to previous CF Workers version
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Reason for rollback" --yes

# Or redeploy a specific commit
git checkout <sha>
npm run deploy:full
git checkout main
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| "Another next build process is already running" | Kill stale node processes: `pkill -u $(id -u) node` then retry |
| D1 migration fails | Check migration number ordering, apply one at a time |
| SHA mismatch | Re-run `npm run deploy:full` — stale deploy |
| NOWPayments IPN not firing | Check webhook URL in NOWPayments dashboard |
| Bot not responding | Re-register webhook via Telegram API |
