# D1 Region Failure Runbook

**Audience:** Platform operator (non-technical CEO) + on-call engineer  
**Scenario:** Cloudflare D1 database (APAC region) is degraded or unreachable  
**RTO Target:** 4 hours (manual restore from last backup)  
**Last updated:** 2026-05-20

---

## Background

Sophia AI Factory uses Cloudflare D1 as its primary database. Our D1 instance (`sophia-raas-db`) runs in the **APAC region** — optimized for Vietnam users but hosted in a single Cloudflare geographic zone.

**Current HA status:** D1 is single-region. There is no automatic failover to another region. If the APAC zone degrades, the database is unavailable until Cloudflare resolves it. This is a known limitation of D1's architecture (as of 2026-05).

**Doctrine decision (2026-05-20):** Sophia accepts APAC-only with documented 4h RTO. Multi-region D1 or replica requires Cloudflare custom enterprise offering — out of scope for current platform tier. This decision is documented and reviewed quarterly.

---

## Detection

### Symptoms
- Users see "Something went wrong" or blank dashboard pages
- API responses return 500 or database error messages
- Cron heartbeat alert fires (if Wave 4 heartbeat is live)
- Sentry events spike with D1/SQLite error messages

### Confirm D1 Outage

```bash
# 1. Check Cloudflare status page first — confirm it's regional, not local
open https://www.cloudflarestatus.com

# 2. Probe production health endpoint
curl -sI https://sophia.agencyos.network/api/health
# If HTTP 200 but features broken → confirm with below

# 3. Run a direct D1 query to test connectivity
npx wrangler d1 execute sophia-raas-db --remote --command "SELECT 1 AS ping;"
# Success: { results: [ { ping: 1 } ] }
# Failure: CF error / timeout
```

### Distinguish D1 outage from code bug

| Symptom | Likely cause |
|---------|-------------|
| All pages broken, `SELECT 1` fails | D1 region outage |
| Specific pages broken, `SELECT 1` works | Code bug / bad migration |
| Intermittent failures (timeout) | D1 regional degradation (partial) |
| 404 on routes | Code deployment issue — see `disaster-recovery.md` |

---

## Step-by-Step Response

### Phase 1 — Confirm and Communicate (0–15 min)

1. **Verify it's a CF D1 outage:** Check [Cloudflare Status](https://www.cloudflarestatus.com). Look for "D1" or "APAC" incidents.
2. **Open a Cloudflare support ticket** (if status page shows no known issue):
   - URL: https://support.cloudflare.com
   - Include: Account ID (`78bd1961-b62d-43bb-b551-0c5d7d389506` prefix), database name `sophia-raas-db`, region `APAC`.
   - Include: `wrangler d1 execute` error output.
3. **Post internal status update** to team channel: "D1 APAC degraded — investigating. ETA: CF SLA (typically 30 min–2h for regional incidents)."
4. **Do not attempt restore yet** — wait for CF to confirm scope. Most D1 regional incidents resolve in < 2h.

### Phase 2 — Wait for CF Resolution (15 min–2h)

- Monitor CF status page for updates.
- Check `wrangler d1 execute sophia-raas-db --remote --command "SELECT 1;"` every 15 minutes.
- If CF resolves: test platform → verify crons re-run normally → confirm with health check.
- If not resolved after 2h: proceed to Phase 3.

### Phase 3 — Manual Restore from Backup (2h–4h)

**When:** CF has not resolved the outage after 2 hours, OR CF confirms data loss.

#### Step 3a: Locate Latest Backup

```bash
# List backups in R2
npx wrangler r2 object list sophia-backups
# Output: list of backup files with timestamps
# Latest backup format: sophia-raas-db-YYYYMMDD-HHMMSS.sql.gz
```

#### Step 3b: Download Backup

```bash
# Download the latest backup file (replace FILENAME with actual name)
npx wrangler r2 object get sophia-backups/FILENAME --file=/tmp/sophia-backup.sql.gz

# Decompress
gunzip /tmp/sophia-backup.sql.gz
# Result: /tmp/sophia-backup.sql
```

#### Step 3c: Assess Restore Target

**If D1 APAC recovers (most likely):**
```bash
# Apply backup to restored D1 — only if data was lost
# WARNING: This overwrites current data. Confirm with CF support that data was lost.
npx wrangler d1 execute sophia-raas-db --remote --file=/tmp/sophia-backup.sql
```

**If D1 APAC is permanently unreachable (rare — CF would migrate data):**
- Contact CF support for data recovery path.
- CF may provide a new D1 instance in a different region.
- If new instance: update `wrangler.toml` `database_id` and redeploy.
- Apply backup SQL to new instance.

#### Step 3d: Verify Restore

```bash
# Count key tables to verify data integrity
npx wrangler d1 execute sophia-raas-db --remote --command "
  SELECT 'user' AS tbl, COUNT(*) AS cnt FROM user
  UNION ALL
  SELECT 'license_keys', COUNT(*) FROM license_keys
  UNION ALL
  SELECT 'billing_events', COUNT(*) FROM billing_events;
"
# Compare row counts against pre-incident known values
```

#### Step 3e: Redeploy Platform

```bash
cd apps/sophia-ai-factory
npm run deploy:full
# Verify SHA match:
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
```

---

## Customer Communication Template

**Subject:** Sophia Platform — Database Maintenance (Update)

---

Dear [Customer Name],

We are experiencing a temporary infrastructure issue affecting our database provider (Cloudflare). This is affecting access to your Sophia AI Factory dashboard and campaigns.

**Status:** We are actively working with Cloudflare to resolve this. Your data is safe.

**Estimated resolution:** [TIME] Vietnam time.

We will send you another update when service is fully restored. We apologize for the disruption.

For urgent matters, contact us at support@mekongmind.com.

Best regards,  
Sophia AI Factory Team

---

## Post-Incident Actions

After service is restored:

1. **Verify all crons resumed:** Check `cron_run_log` table for recent runs.
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote --command \
     "SELECT cron_name, last_run_at, last_status FROM cron_run_log ORDER BY last_run_at DESC LIMIT 20;"
   ```

2. **Check for missed dunning transitions:** Identify users whose dunning state should have advanced during the outage.
   ```bash
   # Manually trigger dunning cron to catch up
   curl -H "x-cron-secret: $CRON_SECRET" https://sophia.agencyos.network/api/cron/dunning-advance
   ```

3. **Check fulfillment queue:** Videos stuck in `queued` state.
   ```bash
   curl -H "x-cron-secret: $CRON_SECRET" https://sophia.agencyos.network/api/cron/fulfillment-retry
   ```

4. **Create postmortem:** Document in `docs/postmortems/YYYYMMDD-d1-region-failure.md`.
   - Duration of outage
   - Customer impact (affected sessions, failed payments, stuck campaigns)
   - Cloudflare ticket ID and resolution
   - Backup used (if any) and data loss window

5. **Review backup cadence:** If backup was more than 24h old, investigate why `d1-backup` cron did not fire.

---

## HA Architecture Options (Future)

Current APAC-only setup is accepted for the current stage. To improve availability:

| Option | Cost | Effort | RTO improvement |
|--------|------|--------|-----------------|
| Monthly DR drills | $0 | Low | Reduces restore time to 2h (practiced) |
| Cloudflare Enterprise D1 | Custom | High | Potential cross-region replica |
| Read-only fallback (static snapshot) | Low | Medium | Partial read-only mode during outage |
| Migration to Turso/libSQL (multi-region) | Medium | High | <1 min RTO — architecture change |

**Decision for Sophia (as of 2026-05-20):** Accept APAC-only with monthly DR drills and documented 4h RTO. Revisit if customer SLA requirements change or if Cloudflare launches D1 HA on paid plans.

---

## Related Files

- `docs/disaster-recovery.md` — general DR procedures
- `docs/runbooks/cf-quota-response.md` — quota exhaustion runbook
- `docs/escalation-contacts.md` — who to call
- `docs/dr-drill-260518.md` — staging DR drill record
- `scripts/check-cf-quota.ts` — quota monitoring
