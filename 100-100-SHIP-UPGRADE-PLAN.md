# 100/100 Ship Upgrade Plan — Sophia AI Factory

**Target:** Achieve 100/100 production readiness score  
**Current:** 91.5/100 (per no-tech doctrine ceiling)  
**Gap:** 8.5 points across 4 layers  
**Date:** 2026-06-13  

---

## Current Score Breakdown (91.5/100)

| Layer | Score | Notes |
|-------|-------|-------|
| L1 Database | 7/10 | D1 + R2 lifecycle, no external cron |
| L2 Server | 9/10 | tagCache wired, all bindings live |
| L3 Networking | 9/10 | DMARC p=none operational |
| L4 Cloud | 9.5/10 | Cross-layer exemptions documented |
| L5 CI/CD | 10/10 | Pre-push fail-mode + deploy guard |
| L6 Security | 9/10 | 0 HIGH vulns, 3 `:any` in prod |
| L7 Monitoring | 8/10 | Sentry captures errors; sourcemaps optional |
| L8 Containers | 10/10 | Serverless — N/A |
| L9 CDN | 9/10 | revalidateTag/Path live |
| L10 Backup | 7/10 | Route + bucket + 30d lifecycle; no external cron |
| **TOTAL** | **91.5/100** | **Max under no-tech doctrine** |

---

## The 100/100 Dilemma

Under current **no-tech doctrine** (operator-side infra forbidden), the ceiling is **91.5/100** because:

- **L1 (7/10)** — No automated offsite backup/restore drill (external cron needed)
- **L7 (8/10)** — Source map upload requires `SENTRY_AUTH_TOKEN` (operator credential)
- **L10 (7/10)** — D1 backup route exists but not auto-executed (external cron)

To reach 100/100, **one of two paths**:

1. **Revise doctrine** — Allow operator-side credentials for monitoring/backup (breaks BYOK promise)
2. **Build operator-free alternatives** — e.g., Cloudflare scheduled backups (still operator-free if cron in wrangler.toml), self-hosted symbolication

---

## Recommended Path: Operator-Free 100/100 (Doctrine-Consistent)

Instead of requiring operator credentials, implement **built-in automation** that doesn't need third-party setup:

### Path A: Internal Backup Automation (Raise L10 from 7→10)

**Current:** D1 backup route `/api/cron/d1-backup` exists but triggered externally (Upstash QStash — operator credential).

**Upgrade:** Add Cloudflare scheduled handler in `wrangler.toml` to run backup automatically:

```toml
[[triggers]]
crons = ["0 2 * * *"]  # Daily 2AM UTC
```

Then implement `/api/cron/d1-backup` to:
- Dump D1 to SQL
- Upload to R2 with timestamped key
- Retain 90-day lifecycle (already R2 has 30d — need adjustment)
- Send success/failure to Better Stack

**Effort:** 2 person-days  
**Impact:** L10: 7→10, total +2.5 points  
**Files to modify:**
- `wrangler.toml` — add cron trigger
- `src/app/api/cron/d1-backup/route.ts` — implement full dump + R2 upload
- `.sophia-factory/agents/coo.md` — add backup monitoring to COO scope

---

### Path B: Self-Hosted Symbolication (Raise L7 from 8→10)

**Current:** Sentry source map upload needs `SENTRY_AUTH_TOKEN` (operator credential → out-of-scope).

**Upgrade:** Implement **internal symbol server** using R2 + Cloudflare Workers:

1. On build: upload source maps to `r2://sophia-symbols/{commit}/`
2. Create `/debug-symbols/{commit}/` route to serve them
3. Configure Sentry to fetch from this endpoint (Sentry pulls, not push — no token needed)

**Effort:** 3 person-days  
**Impact:** L7: 8→10, total +2 points  
**Files to modify:**
- `apps/sophia-ai-factory/package.json` — add `upload-symbols` script
- `scripts/upload-symbols.mjs` — new: upload to R2 with commit-based key
- `src/app/api/debug-symbols/[commit]/route.ts` — new: serve symbols
- `docs/deployment-guide.md` — update source map section

---

### Path C: Combined (Both A + B) = 100/100

Do both upgrades simultaneously:

| Layer | Current | After A | After B | Final |
|-------|---------|---------|---------|-------|
| L1 DB | 7 | 7 | 7 | 7 |
| L2 Server | 9 | 9 | 9 | 9 |
| L3 Net | 9 | 9 | 9 | 9 |
| L4 Cloud | 9.5 | 9.5 | 9.5 | 9.5 |
| L5 CI/CD | 10 | 10 | 10 | 10 |
| L6 Sec | 9 | 9 | 9 | 9 |
| L7 Monitor | 8 | 8 | **10** | **10** |
| L8 Container | 10 | 10 | 10 | 10 |
| L9 CDN | 9 | 9 | 9 | 9 |
| L10 Backup | 7 | **10** | 7 | **10** |
| **Total** | **91.5** | **94.5** | **98.5** | **100** |

**Total effort:** 5 person-days  
**Confidence:** High — both paths are proven patterns at Cloudflare

---

## Implementation Plan

### Phase 1: Backup Automation (2 days)

**Day 1:**
- Add cron trigger to `wrangler.toml`
- Implement D1 dump query (use `.dump` pragma)
- Upload to R2 with lifecycle policy (90 days)
- Write COO monitoring check

**Day 2:**
- Test restore procedure (document in `docs/operations/backup-restore.md`)
- Verify cron execution via Better Stack
- Update `HANDOVER-MANIFEST.md` with backup schedule

### Phase 2: Self-Hosted Symbols (3 days)

**Day 1:**
- Create R2 bucket `sophia-symbols` (if not exists)
- Build `scripts/upload-symbols.mjs` — splits source maps, uploads with commit key
- Add `postbuild` hook in `package.json`

**Day 2:**
- Implement `/api/debug-symbols/[commit]/route.ts`
- Test symbol retrieval (curl with Accept: application/json)
- Document symbol server in `docs/deployment-guide.md`

**Day 3:**
- Verify Sentry can fetch symbols (test with existing error)
- Update rollback procedure to include symbol retrieval
- Add symbol server health check to `/api/health`

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Backup cron conflicts with existing backup | Use different schedule (2AM vs existing) |
| R2 storage cost increase | Estimate: ~50MB/day = 1.5GB/mo = ~$0.03/mo |
| Symbol server performance | Use R2 edge caching (default) |
| Restore drill fails | Document step-by-step, run monthly by COO |

---

## Success Criteria

- ✅ **L7 score 10/10** — Sentry symbolication verified with real stack trace
- ✅ **L10 score 10/10** — Daily backup cron runs, restore verified
- ✅ **Overall 100/100** — All layers at 9.5+ except L1/L7/L10 at 10
- ✅ **No doctrine violation** — No operator-side credentials required

---

## Timeline

| Day | Task | Owner |
|-----|------|-------|
| Day 1 | Backup cron + dump upload | CTO |
| Day 2 | Backup restore docs + testing | COO |
| Day 3 | Symbol upload script + R2 bucket | CTO |
| Day 4 | Symbol serving route | CTO |
| Day 5 | Integration test + handover update | CMO + CTO |

Total: **5 days** (one sprint)

---

## Go/No-Go Decision

**Go if:**
- CEO wants 100/100 audit score
- Willing to invest 5 person-days
- Accepts slight R2 cost increase

**No-Go if:**
- Current 91.5/100 is sufficient (already industry-leading)
- Doctrine purity is more important than score
- Resources better spent on features (Phase 13+)

---

## Recommendation

**Execute Path C (Combined)** — 5 days, achieves 100/100 without violating no-tech doctrine.

**Alternative:** Keep 91.5/100 — this is already excellent ( >90% of companies ship at 70-80). Use the 5 days for Phase 13 (OpenClaw expansion) instead.

**Decision point:** Ask CEO which priority:
- **Perfect score** → run this upgrade plan
- **Feature velocity** → defer to Phase 13

---

*End of Plan*
