# Operational Playbooks

This document contains standard operating procedures (SOPs) for the deployment, release lifecycle, incident management, backups, database schema references, and background queue tracking.

---

## 1. Release & Deployment Playbook

### Standard Deployment Process
Deployments compile client assets, run post-build handlers, and ship the Edge bundle to Cloudflare:
```bash
cd apps/sophia-ai-factory
npm run deploy
```
*Note*: This runs `npm run build`, executes `scripts/fix-instrumentation-standalone.mjs`, invokes `opennextjs-cloudflare build`, runs `scripts/inject-scheduled-handler.mjs` to inject cron hooks, and triggers wrangler deployment.

### Schema Migration Deployments
If a change includes database schema updates:
1. Dry-run migrations locally to ensure SQL safety.
2. Apply changes to production Cloudflare D1 instance:
   ```bash
   npm run deploy:migrations
   ```
3. Check application status immediately after migration completes:
   ```bash
   npm run deploy:verify
   ```

### Rollback Protocol
If a deployment triggers high error counts or fails verification:
1. Revert to the last verified commit on the main branch.
2. Re-run `npm run deploy` to override the edge worker.
3. If D1 migrations need reversion, apply fallback script:
   ```bash
   npx wrangler d1 execute DB --remote --file=migrations/rollback-last.sql
   ```

---

## 2. Incident Response Playbook

### Severity Definition
- **P0**: Entire application offline, payment services fail, or core data corruption.
- **P1**: Core feature failure (e.g. video rendering offline, users cannot log in).
- **P2**: Intermittent API warnings, reporting/analytics lag.
- **P3**: Layout bugs, minor text typos.

### Outage Recovery Walkthrough (P0/P1)
1. **Identify**: Check Cloudflare Worker error logs inside the Cloudflare Dashboard under log streams.
2. **Isolate**: If an external API is causing errors (e.g. ElevenLabs), toggle mock mode variables via Cloudflare config panel to bypass live API calls.
3. **Notify**: Broadcast status updates to internal engineering.
4. **Fix & Deploy**: Follow the Rollback or Hotfix deployment procedure.

---

## 3. Backup & Disaster Recovery (DR)

### D1 SQLite Database Backups
- **Automated Backup**: Scheduled to execute daily at 05:00 UTC.
- **Endpoint**: `/api/cron/d1-backup`
- **Output Destination**: Dump files are compressed (.sql.gz) and saved to the `sophia-backups` Cloudflare R2 bucket.
- **Retention**: Saved for a rolling window of 90 days.

### Manual Backup Generation
Generate a database dump on demand:
```bash
npx wrangler d1 export DB --remote --output=./backup-on-demand.sql
```

---

## 4. Secret & API Key Rotation

1. **Rotate Wrangler secret variables**:
   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY
   ```
2. **Inngest Signing Keys**: Rotate keys on the Inngest Cloud console, then update `INNGEST_SIGNING_KEY` inside Cloudflare wrangler secrets.
3. **TikTok/Meta Tokens**: Tokens are refreshed automatically via the background token refresh cron, but manual rotation can be triggered by calling the endpoint: `/api/cron/token-refresh` with administrative credentials.

---

## 5. Database Schema & Relationships Reference

### Primary Schema Tables

1. **`organizations`**
   - Stores corporate/tenant metadata.
   - Primary Key: `id` (UUID).
   - Relations: Has many `subscriptions` and `org_members`.

2. **`org_balances`**
   - Keeps track of compute unit balances.
   - Primary Key: `org_id` (UUID, references `organizations.id`).
   - Fields: `balance` (numeric, default 50).

3. **`user_mcu_balance`**
   - Atomic balance tracker per user.
   - Primary Key: `user_id` (UUID).
   - Fields: `credits_remaining`, `credits_total_purchased`, `credits_total_used`.

4. **`mcu_transactions`**
   - Transaction ledger for audit trails.
   - Primary Key: `id` (UUID).
   - Relations: `user_id` (references `user_mcu_balance.user_id`).

---

## 6. Background Cron & Queue Reference

### Cron Routing Table
- **Daily 05:00 UTC**: `/api/cron/d1-backup`, `/api/cron/error-digest`
- **Daily 07:00 UTC**: `/api/cron/llm-cache-purge`
- **Every 4 Hours**: `/api/cron/affiliate-scout`
- **Hourly at Min 10**: `/api/cron/wallet-rebuild`
- **Every 10 Minutes**: `/api/cron/heartbeat`

### Inngest Event Queue Lifecycles
```
[User Action / Cron Trigger] ──> [Inngest Event Dispatched]
                                            │
                                            ▼
                               [serve() route execution]
                                            │
                                            ▼
                                 [Step Function Enqueue]
                                            │
                               ┌────────────┴────────────┐
                               ▼                         ▼
                         [Success State]          [Failure State]
                               │                         │
                               ▼                         ▼
                        [Commit ledger]         [Trigger refund & logs]
```
- Active queues include `videoGenerate` (generates scripts, renders tracks), `batchVideoFanout` (handles high-throughput multi-avatar rendering), and `repurposeClipGenerate` (repurposing video sources).
