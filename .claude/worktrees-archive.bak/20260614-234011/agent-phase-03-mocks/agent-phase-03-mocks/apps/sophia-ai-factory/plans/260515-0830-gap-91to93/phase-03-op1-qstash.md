# Phase 03 — OP-1 Register Upstash QStash Cron

**Priority:** P1 (closes L1+L10 score gap)
**Status:** blocked (waiting for user QSTASH_TOKEN)
**Effort:** 15min post-cred
**Score Δ:** +1 (Layer 1 +0.5, Layer 10 +0.5)

## Context

`/api/cron/d1-backup` route ready since Phase 4 (2026-05-13). Worker bindings verified post-Phase 5.1 (`8d525481`). The ONLY missing piece: external cron must fire the route daily.

`scripts/dr/configure-upstash-qstash.sh` does the registration. Operator one-shot.

## Requirements

User must provide:
1. **Upstash account** with QStash enabled (free tier sufficient — 500 messages/day)
2. **`QSTASH_TOKEN`** from Upstash dashboard → QStash → Console → Token
3. **`CRON_SECRET`** — already set as wrangler secret on prod; retrieve via `npx wrangler secret get CRON_SECRET` (returns last 4 chars only — full value needed; user provides from password manager)

## Key Insights

- QStash signs every webhook with HMAC — route already verifies via `verifyCronAuth()` in `src/seed/auth/verify-cron-auth.ts`.
- Schedule: `0 3 * * *` UTC = 10:00 ICT — off-peak.
- Failures retry 3x then dead-letter to QStash console.
- 30-day R2 lifecycle on `sophia-backups` bucket auto-deletes old snapshots.

## Architecture

```
[Upstash QStash cron 03:00 UTC]
   │
   └─► HTTPS POST https://sophia.agencyos.network/api/cron/d1-backup
       Authorization: Bearer ${CRON_SECRET}
       │
       └─► verifyCronAuth() OK
           │
           └─► buildD1Dump(DB) → string
               │
               └─► BACKUPS_BUCKET.put(`d1-backup-YYYYMMDD-HHMMSS.sql`, dump)
                   │
                   └─► recordCronRun(success) + heartbeat to BetterStack
```

## Related Files

- `src/app/api/cron/d1-backup/route.ts` (production handler)
- `src/forest/dr/d1-dump-builder.ts` (dump serialization)
- `src/seed/auth/verify-cron-auth.ts` (HMAC verify)
- `scripts/dr/configure-upstash-qstash.sh` (registration one-shot)
- `docs/dev-sops.md` SOP 14 (full runbook)

## Implementation Steps

### User-blocked prerequisite

User provides 2 secrets:
- `QSTASH_TOKEN=qst_...`
- `CRON_SECRET=<value from password manager>`

### Execution (after user provides)

```bash
# 1. Run registration
cd apps/sophia-ai-factory
QSTASH_TOKEN=$QSTASH_TOKEN CRON_SECRET=$CRON_SECRET bash scripts/dr/configure-upstash-qstash.sh

# Expected output:
# ✅ QStash schedule registered: schd_xxxxx
# Target: https://sophia.agencyos.network/api/cron/d1-backup
# Cron: 0 3 * * * (UTC)
# Next fire: <ISO timestamp>

# 2. Wait for first cron fire (or force-trigger via QStash console "Publish Now")

# 3. Verify backup uploaded
npx wrangler r2 object list sophia-backups --prefix=d1-backup- | head -3
# Should see at least one file with today's date

# 4. Verify cron_run_log entry
npx wrangler d1 execute sophia-raas-db --remote \
  --command="SELECT job, ran_at, success FROM cron_run_log WHERE job='d1-backup' ORDER BY ran_at DESC LIMIT 3;"

# 5. (Optional) Manually download + verify integrity
npx wrangler r2 object get sophia-backups/d1-backup-$(date +%Y%m%d)-*.sql --file=/tmp/test-restore.sql
head -50 /tmp/test-restore.sql
# Should see migration-style SQL: CREATE TABLE ... INSERT INTO ...
```

## Todo List

- [ ] User: sign up Upstash + obtain QSTASH_TOKEN
- [ ] User: retrieve CRON_SECRET from password manager
- [ ] Run `configure-upstash-qstash.sh` with both env vars
- [ ] Verify registration response shows `schd_*` ID
- [ ] Wait or force-trigger first fire
- [ ] Verify R2 backup file exists
- [ ] Verify `cron_run_log` table has success row
- [ ] (Optional) Download + spot-check backup integrity
- [ ] Update changelog v1.27.x with QStash schedule ID

## Success Criteria

- `r2 object list sophia-backups --prefix=d1-backup-` returns ≥1 file
- `cron_run_log` SELECT shows `success=1` for `job='d1-backup'`
- First backup file is parseable SQL (CREATE TABLE + INSERT)
- BetterStack heartbeat shows green for `d1-backup` monitor (if user has BetterStack)

## Risk Assessment

- **Wrong CRON_SECRET** → route returns 401, QStash retries 3x then DLQ. Recoverable by re-running with correct value.
- **QStash rate limit** on free tier (500/day) — daily cron uses 1/day, plenty headroom.
- **Production deploy without --config flag** would drop BACKUPS_BUCKET binding → 500 on cron. Fixed since Phase 5.1, but verify pre-deploy ESLint of `scripts/deploy-with-sha.sh` still has the flag.

## Security Considerations

- `QSTASH_TOKEN` is sensitive — only used in registration script invocation, not committed.
- `CRON_SECRET` is already a wrangler secret — never logged.
- HMAC verification rejects any unsigned POST, including replays.

## Next Steps

- Phase 04 (Sentry) can run in parallel with this
- Phase 05 (DMARC) waits 30d after Resend sends — not gated by this
