## Phase Implementation Report

### Executed Phase
- Phase: phase-04-cron-r2-video-storage
- Plan: plans/260429-1925-byok-video-zero-bug
- Status: completed

### Files Modified
- `apps/sophia-ai-factory/wrangler.toml` — added comment clarifying `*/5 * * * *` also covers video-status-sync (via GH Actions `cron-video-status-sync.yml`); no new cron entry needed (schedule already present)
- `apps/sophia-ai-factory/src/lib/video/video-storage-service.ts` — added optional `r2Key?: string` param to `downloadAndStore()` allowing callers to supply explicit R2 key instead of auto-generated campaign path
- `apps/sophia-ai-factory/src/app/api/cron/video-status-sync/route.ts` — wired R2 copy after completed status; fixed `await getHeyGenClient()` (was called sync, now async); updated D1 UPDATE to include `r2_key`, `r2_size_bytes` columns
- `apps/sophia-ai-factory/src/app/api/cron/video-status-sync/route.test.ts` — created (7 tests)

### Cron schedule added
**Finding:** `*/5 * * * *` already present in `wrangler.toml` crons array. No duplicate added. OpenNext worker has no `scheduled` handler — the route is triggered externally via `.github/workflows/cron-video-status-sync.yml` (already exists at git root level, `Bearer $CRON_SECRET`). Wrangler comment updated to document the dual purpose.

```toml
crons = ["*/5 * * * *", "5 * * * *", "0 1 * * *", ...]
# "*/5 * * * *" → /api/cron/uptime-check + /api/cron/video-status-sync (GH Actions)
```

### R2 wire change (cron route diff summary)
After `TERMINAL.has(status.status)` branch:
```
+ if status === 'completed' && video_url:
+   storageKey = `videos/${user_id}/${video_id}.mp4`
+   stored = await downloadAndStore(video_url, video_id, storageKey)
+   r2Key = stored.path; r2SizeBytes = stored.sizeBytes
+ on error: logger.error(...) — continue, r2Key stays null
UPDATE videos SET status,video_url,thumbnail_url,error,r2_key,r2_size_bytes,updated_at WHERE id
```

### Tests Status
- Unit tests: 7/7 pass (`npx vitest run src/app/api/cron/video-status-sync/`)
- tsc (owned files): 0 errors in video-status-sync/route.ts and video-storage-service.ts
- Pre-existing tsc errors (other phases — not introduced here): ~15 errors in factory.ts, video-service.ts, heygen routes (Phase 02A/02B scope)

### Issues Encountered
- `getHeyGenClient` signature changed to `async` by Phase 02A — original route called it synchronously. Fixed in route.ts (`await getHeyGenClient()`).
- OpenNext does not export a `scheduled` Cloudflare handler — cron routing is via GitHub Actions curl (pre-existing pattern). No wrangler `[triggers]` routing change needed.

### Bottom Line
CRON SCHEDULED (via GH Actions, already live) + R2 COPY LIVE ✅

### Downstream note (future phase)
Read-side (e.g. `/api/videos` list route or video-gallery component) returns `video_url` from D1. Should prefer R2 public URL when `r2_key IS NOT NULL`: `${R2_PUBLIC_BASE_URL}/${r2_key}` else `video_url`. This file is NOT owned by Phase 04 — flag for Phase 05 or dedicated follow-up.
