# Disaster Recovery (DR) Runbook

**Sophia AI Factory — Cloudflare Workers Infrastructure**

---

## Executive Summary

This runbook defines recovery procedures for Sophia AI Factory's production infrastructure. Our target Recovery Time Objective (RTO) is **4 hours** with a Recovery Point Objective (RPO) of **24 hours**.

| Component | RTO | RPO | Recovery Priority |
|-----------|-----|-----|-------------------|
| D1 Database | 30 min | 24 h | P1 (Critical) |
| R2 Cache | 1 h | 0 h | P2 (Regenerable) |
| Worker Code | 15 min | Real-time | P1 (GitHub source of truth) |
| KV Namespace | 2 h | 24 h | P3 (Low priority) |

---

## Component Overview

### D1 Database (`sophia-raas-db`)

**Purpose:** Primary data store for user profiles, billing records, campaigns, videos.
- **Binding:** `DB` in `wrangler.toml`
- **Database ID:** `78bd1961-b62d-43bb-b551-0c5d7d389506`
- **Backup Strategy:** Daily automated exports + manual snapshots before deployments

**Data criticality:** HIGH — Contains user accounts, payment records, campaign state.

### R2 Bucket (`sophia-ai-factory-opennext-cache`)

**Purpose:** Next.js incremental static regeneration (ISR) cache.
- **Binding:** `NEXT_INC_CACHE_R2_BUCKET`
- **Regeneration:** Automatic on next request after cache miss
- **Data criticality:** LOW — Cache is regenerable

### KV Namespace (`EXPERIMENT_KV`)

**Purpose:** Feature flag + A/B experiment state, 60s TTL.
- **Binding:** `EXPERIMENT_KV`
- **Namespace ID:** `c3857792e4014334ba31b62b19d2f32a`
- **Data criticality:** MEDIUM — Configuration, can be manually re-seeded

### Worker Code

**Purpose:** All runtime logic.
- **Source of truth:** GitHub repo `longtho638-jpg/sophia-ai-factory`, branch `main`
- **Deploy:** CI/CD workflow `Tests & Deploy` on `git push origin main`
- **Artifact:** `.open-next/worker.js` (compiled by OpenNext)
- **Data criticality:** HIGH — Controls all functionality

---

## Normal Backup Operations

### Automated D1 Export

**Frequency:** Daily at 02:00 UTC (via cron)

```bash
# Run manually anytime:
scripts/dr/d1-snapshot.sh

# Expected output:
# Backing up D1 database 'sophia-raas-db'...
# Success! Snapshot saved to: backups/d1-2026-04-28-020000.sql
# File size: 45.2 MB
```

**Retention:** Keep last 30 snapshots (automatic cleanup).
**Location:** `backups/d1-*.sql` in working directory.

### R2 Cache Regeneration (Automatic)

No manual action needed. Cache invalidation is automatic:
- On `GET /` or cached route: served from R2 if hit
- On cache miss: regenerated and stored back in R2
- On Worker deploy: old cache keys are orphaned (safe; garbage collection on 30-day TTL)

### KV Seed (Manual)

If KV needs reset:

```bash
# Re-seed feature flags (use Cloudflare dashboard or wrangler)
npx wrangler kv:key put --namespace-id=c3857792e4014334ba31b62b19d2f32a \
  "flag_premium_avatars" '{"enabled": true, "rollout_pct": 100}'
```

---

## Recovery Procedures

### Scenario 1: D1 Database Corruption / Data Loss

**Symptoms:** Database errors, missing records, transaction rollbacks.

**RTO:** 30 minutes | **RPO:** 24 hours (one day of data loss acceptable)

#### Step 1: Confirm Disaster State

```bash
# SSH into Cloudflare dashboard or run health check
curl -s https://sophia.agencyos.network/api/health | jq '.database'

# Expected: {"status": "error", "error": "database connection failed"}
# If error appears, proceed to Step 2
```

#### Step 2: Identify Latest Good Snapshot

```bash
ls -lh backups/d1-*.sql | tail -5
# Pick the latest pre-incident snapshot, e.g.:
# backups/d1-2026-04-28-020000.sql (from 02:00 UTC today)
```

#### Step 3: Restore from Snapshot

**WARNING:** This OVERWRITES the current database. Only run if data is confirmed corrupt.

```bash
# Dry-run (recommended first):
scripts/dr/restore-from-snapshot.sh

# Output should show the snapshot to restore and NO actual changes:
# Ready to restore from: backups/d1-2026-04-28-020000.sql
# Preview: Would restore 1453 rows across 12 tables
# To confirm: Run with --confirm flag

# Actual restore (requires --confirm):
scripts/dr/restore-from-snapshot.sh --confirm

# Expected output:
# ✅ Restore complete. Database snapshot applied.
# Rows restored: 1453
# Tables affected: 12
# Timestamp: 2026-04-28T22:00:00Z
```

#### Step 4: Validate Recovery

```bash
# Health check should now pass
curl -s https://sophia.agencyos.network/api/health | jq '.database'

# Expected: {"status": "ok"}

# Test user login (have a test account ready)
# Visit https://sophia.agencyos.network → check if login works
```

#### Step 5: Document Incident

Create incident report:
```bash
cat >> docs/incidents.log <<'EOF'
[2026-04-28 22:15 UTC] D1 Corruption Incident
- Duration: 15 minutes
- Root cause: [TO BE DETERMINED]
- Data loss: ~2 hours (last backup was 02:00 UTC)
- Recovery method: Restore from snapshot
- Status: RESOLVED
- Follow-up: Investigate root cause and implement safeguards
EOF
```

---

### Scenario 2: R2 Cache Failure

**Symptoms:** 503 errors, "ISR cache unavailable", slow page loads.

**RTO:** 1 hour | **RPO:** 0 hours (data is regenerable)

#### Step 1: Verify Cache Issue

```bash
# Check R2 bucket status (Cloudflare dashboard)
# Or run: npx wrangler r2 bucket list
# Verify bucket "sophia-ai-factory-opennext-cache" exists

# If bucket shows as "error" or inaccessible: proceed to Step 2
```

#### Step 2: Re-seed Cache (Automatic)

The next `GET` to any cached route will automatically regenerate:

```bash
# Option A: Manual trigger (crawl homepage to warm cache)
curl -I https://sophia.agencyos.network/

# Option B: Full crawl (warm all ISR routes)
scripts/dr/restore-from-snapshot.sh --warm-cache
```

#### Step 3: Validate

```bash
# Check performance metrics (Cloudflare Analytics)
# Verify page load times have recovered to baseline (~2s)
```

---

### Scenario 3: Worker Code Regression / Deploy Failure

**Symptoms:** 500 errors, pages not rendering, API calls failing after recent deploy.

**RTO:** 15 minutes | **RPO:** Real-time (code is in Git)

#### Step 1: Identify Broken Commit

```bash
# View recent runs
gh run list --workflow "Tests & Deploy" -L 5 --json conclusion,databaseId,name

# If latest run shows "failure": locate the broken commit
git log --oneline origin/main | head -10
# Find the commit that corresponds to the failed run

# Check CI logs for errors
gh run view <RUN_ID> --log-failed
```

#### Step 2: Rollback via Git

**Option A: Revert the bad commit**

```bash
# Identify bad commit (e.g., abc1234)
BAD_COMMIT="abc1234"

# Revert it
git revert $BAD_COMMIT

# Push to main (auto-triggers Tests & Deploy)
git push origin main

# Verify CI passes and production recovers
gh run list -L 1 --json conclusion
```

**Option B: Rollback to last known good (force-push, LAST RESORT)**

```bash
# Only if revert cannot be used
LAST_GOOD_SHA="<from your memory or git tag>"
git reset --hard $LAST_GOOD_SHA
git push origin main --force

# ⚠️ Force-push is dangerous — use only in emergency
# Notify team immediately after
```

#### Step 3: Validate Production

```bash
# Monitor deployment
MAX=16; n=0
while [ $n -lt $MAX ]; do
  n=$((n+1))
  STATUS=$(gh run list -L 1 --json conclusion -q '.[0].conclusion')
  echo "[$n/$MAX] Deployment status: $STATUS"
  [ "$STATUS" = "success" ] && break
  sleep 30
done

# Verify API response
curl -s https://sophia.agencyos.network/api/version | jq '.'

# Expected: shortSha matches your rollback/revert commit
```

---

### Scenario 4: KV Namespace Data Loss

**Symptoms:** Feature flags not applied, A/B tests missing, slow feature rollouts.

**RTO:** 2 hours | **RPO:** 24 hours

#### Step 1: Re-seed KV

```bash
# Access Cloudflare Dashboard
# Or use wrangler CLI:

npx wrangler kv:key put --namespace-id=c3857792e4014334ba31b62b19d2f32a \
  "flag_premium_avatars" '{"enabled": true, "rollout_pct": 100}'

# Bulk restore from backup (if available)
# TODO: Implement KV backup export to JSON
```

#### Step 2: Verify

```bash
curl -s https://sophia.agencyos.network/api/experiments | jq '.flags'
# Should return current feature flag state
```

---

## Recovery Test Cadence

### Quarterly DR Drill (Next: September 1, 2026)

**Objective:** Verify recovery procedures work end-to-end.

**Schedule:** First Tuesday of Q3, Q4 (e.g., September 1, December 1)

**Participants:**
- Tech lead (recovery captain)
- DevOps engineer (execution)
- Product (communication)

**Participants:**
- Tech lead (recovery captain)
- DevOps engineer (execution)
- Product (communication)

**Drill Steps:**

1. **Announce:** "DR Drill in progress — no action required" in Slack
2. **Simulate:** Create a test snapshot 4 hours old
3. **Execute:** Run full restore procedure
4. **Validate:** Confirm all services operational
5. **Document:** Record timing, issues, improvements
6. **Debrief:** Team discussion + update runbook

**Success Criteria:**
- D1 restore completes in < 30 min ✓
- Production HTTP 200 within 5 min of restore ✓
- No data loss beyond RPO ✓
- Team can execute without external help ✓

---

## Roles & Responsibilities

| Role | Responsibilities |
|------|------------------|
| **Tech Lead** | Declare disaster, authorize recovery, approve risky operations |
| **DevOps Engineer** | Execute restoration scripts, monitor progress, validate recovery |
| **Product Manager** | Draft customer comms, manage timelines, post-incident review |
| **CEO/Founder** | Final approval for major decisions, customer-facing comms |

---

## Communication Template

### Internal (Slack #incidents)

```
🚨 INCIDENT: Database Corruption Detected
- Time: 2026-04-28 22:10 UTC
- Duration: ~15 min
- Impact: User logins affected (3% of active sessions)
- Status: INVESTIGATING

Tech lead will provide updates every 15 minutes.
```

### Customer-Facing (Email + Status Page)

**Vietnamese:**
```
Chúng tôi đang xử lý sự cố cơ sở dữ liệu.
Dự kiến khôi phục trong 30 phút.
Cảm ơn sự kiên nhẫn của bạn!
```

**English:**
```
We're working on a database issue.
Expected recovery within 30 minutes.
Thank you for your patience!
```

### All Clear (Once Resolved)

```
✅ RESOLVED: Database restored from backup (2026-04-28 02:00 UTC)
- Data loss: ~20 hours (acceptable per RPO)
- Service: Fully operational
- Post-incident review scheduled for Tuesday

Next steps: Root cause analysis + prevention measures.
```

---

## Appendix: Quick Reference

### Commands Cheat Sheet

```bash
# Check health
curl -s https://sophia.agencyos.network/api/health | jq '.'

# View latest backup
ls -lh backups/d1-*.sql | tail -1

# Dry-run restore
scripts/dr/restore-from-snapshot.sh

# Actual restore (DANGEROUS)
scripts/dr/restore-from-snapshot.sh --confirm

# Check deployment status
gh run list -L 1 --json conclusion

# View version deployed
curl -s https://sophia.agencyos.network/api/version | jq '.shortSha'

# Monitor logs in real-time
wrangler tail --name sophia-ai-factory
```

### Contact Information

- **On-call tech lead:** [TBD — add phone]
- **CEO:** [TBD — add email]
- **Cloudflare support:** https://dash.cloudflare.com/support

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-04-28 | DevOps Team | Initial draft — DR procedures + RTO/RPO definitions |
| 2026-05-18 | debugger agent | Full DR drill completed — RTO = 13s, RPO = 0s |
| 2026-06-17 | Claude Opus 4.8 | Quarterly verification drill — infrastructure audit, schema analysis, next drill scheduled |

**Last reviewed:** 2026-06-17
**Next review:** 2026-09-01 (quarterly)
**Next drill:** 2026-09-01 (Q3 full restore test)
