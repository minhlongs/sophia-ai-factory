# Operational Runbooks

This document contains standard operating procedures (SOPs) for configuring, rotating, and validating production components of the Sophia AI Factory platform.

---

## 1. Background Cron Management

Most scheduled endpoints are defined in `wrangler.toml` under `[triggers]` and activate automatically upon deployment.

### Cron Routing Table
The following crons run in production to manage background maintenance and integrations:

* **`*/5 * * * *` (Every 5 minutes)**: `/api/cron/heartbeat` — System health and liveness monitor.
* **`*/10 * * * *` (Every 10 minutes)**: `/api/cron/video-fulfillment` — Checks pending video rendering states from HeyGen.
* **`0 */4 * * *` (Every 4 hours)**: `/api/cron/affiliate-scout` — Scans for new affiliate sign-ups and updates referral tiers.
* **`10 * * * *` (Every hour at minute 10)**: `/api/cron/wallet-rebuild` — Audits ledger transactions and synchronizes `org_balances`.
* **`0 5 * * *` (Daily at 05:00 UTC)**: `/api/cron/d1-backup` — Exports database schema and compressed data dumps to R2 backups.
* **`0 7 * * *` (Daily at 07:00 UTC)**: `/api/cron/llm-cache-purge` — Cleans up stale prompt completions from the global `llm_cache` table.

### Manual Cron Triggers
If a cron execution fails, operators can trigger the route manually using a Bearer token:
```bash
curl -X POST https://sophia.agencyos.network/api/cron/wallet-rebuild \
  -H "Authorization: Bearer CRON_SECRET_KEY" \
  -d "force=true"
```

---

## 2. Secrets & API Key Rotation

All credentials must be rotated on a regular schedule or immediately if a compromise is suspected.

### Rotation of App Integration Secrets
Execute wrangler commands to overwrite Cloudflare Workers secrets:
```bash
# Rotate OpenAI/OpenRouter api keys
npx wrangler secret put OPENROUTER_API_KEY

# Rotate payment gateway secrets
npx wrangler secret put NOWPAYMENTS_IPN_SECRET

# Rotate auth tokens
npx wrangler secret put BETTER_AUTH_SECRET
```
After updating any secret, verify the list using `npx wrangler secret list`. Cloudflare Workers automatically apply the new credentials to running instances without requiring a code rebuild.

---

## 3. Database Snapshot & Backups

Sophia executes daily exports of the SQLite/D1 database schema and tables.

### Manual Backup Generation
Generate an on-demand SQL dump from the production database:
```bash
npx wrangler d1 export sophia-raas-db --remote --output=./backups/sophia-backup-manual.sql
```

### Database Restore Procedure
If database tables are corrupted:
1. Fetch the latest successful compressed snapshot from the `sophia-backups` R2 bucket.
2. Decompress the `.sql.gz` file to retrieve the raw SQL script.
3. Import the backup to the remote Cloudflare D1 database:
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote --file=./backups/sophia-backup-manual.sql
   ```
4. Verify database health and row validation by visiting the `/api/health` check endpoint.
