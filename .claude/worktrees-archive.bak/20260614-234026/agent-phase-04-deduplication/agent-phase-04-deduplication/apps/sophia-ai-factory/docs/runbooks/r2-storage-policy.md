# R2 Storage Growth & Cleanup Policy

**Document ID:** RUN-R2-001
**Effective Date:** 2026-05-20
**Review Date:** 2026-08-20 (Quarterly)
**Owner:** Platform Ops
**Scope:** Cloudflare R2 buckets bound to Sophia Workers runtime.

---

## 1. Bucket Inventory

| Binding | Bucket name | Purpose | Growth driver | Lifecycle |
|---|---|---|---|---|
| `NEXT_INC_CACHE_R2_BUCKET` | `sophia-ai-factory-opennext-cache` | Next.js ISR / `revalidateTag` artifacts | Page rebuilds | Auto-evicted by OpenNext runtime |
| `VIDEO_BUCKET` | `sophia-videos` | Rendered Remotion campaign videos (customer-facing) | Per-campaign mp4 (5-60 MB) | **None — manual policy needed** |
| `BACKUPS_BUCKET` | `sophia-backups` | D1 dumps + structured backups via `/api/cron/d1-backup` | Daily dump (~10-50 MB) | **30-day lifecycle (set on bucket)** |

---

## 2. Retention Rules

### 2.1 `sophia-ai-factory-opennext-cache`
- Managed by OpenNext (`@opennextjs/cloudflare`) — entries are evicted on revalidation.
- **Operator action:** none.
- Failure mode: stale cache → manual purge via `wrangler r2 object delete` or full bucket empty (last resort).

### 2.2 `sophia-videos` (PRIMARY GROWTH RISK)
- Stores user-generated MP4 rendered by Remotion render worker.
- **Current policy:** indefinite retention.
- **Recommended policy:** delete videos > **90 days** old, unless tier = `ENTERPRISE | MASTER` (keep forever).
- **Implementation:** Not yet automated. Manual cleanup via:
  ```bash
  # List old objects
  npx wrangler r2 object list sophia-videos --prefix campaigns/ \
    --jq '.[] | select(.uploaded < "2026-02-20") | .key'
  # Delete each
  npx wrangler r2 object delete sophia-videos <key>
  ```
- **Per-tier override:** ENTERPRISE/MASTER users may request indefinite retention via support ticket; recorded in `video_retention_overrides` table (TBD).

### 2.3 `sophia-backups`
- **R2 bucket lifecycle:** 30-day auto-delete (configured on bucket).
- Verify:
  ```bash
  npx wrangler r2 bucket lifecycle list sophia-backups
  ```
- If missing, apply:
  ```bash
  npx wrangler r2 bucket lifecycle add sophia-backups \
    --rule-id "expire-30d" --expire-days 30
  ```

---

## 3. Storage Cost Reality (CF R2)

| Tier | Storage | Class A (writes) | Class B (reads) |
|---|---|---|---|
| Free tier | 10 GB | 1M/mo | 10M/mo |
| Paid | $0.015/GB-mo | $4.50 / 1M | $0.36 / 1M |

**Rough monthly costs at scale (paid tier):**
- 100 GB video storage: ~$1.50/mo
- 1 TB video storage: ~$15/mo
- Backups (30-day rolling, ~1.5 GB): negligible

**Anti-pattern:** treating R2 as cold-storage for everything — egress is free but rebuilding R2 → D1 indexes is operationally expensive.

---

## 4. Operator Actions

| Trigger | Action | Frequency |
|---|---|---|
| Free-tier 80% storage warning (Cloudflare email) | Audit `sophia-videos` for orphaned/old objects | When alert fires |
| Customer reports missing video > 90 days | Check `sophia-videos`; if expired, regenerate via render worker | Ad-hoc |
| Quarterly review | Verify lifecycle policies + cost trend; tune retention | Every 3 months |
| New R2 binding added | Update this doc + decide retention policy BEFORE first write | Per PR |

---

## 5. Cross-References

- `docs/runbooks/application-log-retention.md` — log streams retention (RUN-LOG-001)
- `docs/runbooks/cf-quota-response.md` — Cloudflare quota alerts
- `apps/sophia-ai-factory/wrangler.toml` — bucket bindings source-of-truth
- `apps/sophia-ai-factory/src/app/api/cron/d1-backup/route.ts` — backup producer

---

## 6. Unresolved

- `video_retention_overrides` table not yet created — currently no way for support to flag a video as "keep forever" for ENTERPRISE customers
- 90-day video cleanup is **manual** — automation (cron route `/api/cron/r2-cleanup`) deferred until customer demand or storage cost exceeds $10/mo
- No alerting on per-bucket growth rate (CF doesn't expose this in free tier); operator relies on monthly billing surprise
