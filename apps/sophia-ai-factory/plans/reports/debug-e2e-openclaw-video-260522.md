# E2E OpenClaw Video Pipeline — Debug Report
**Date:** 2026-05-22  
**Scope:** runtime/dynamic analysis (no code-reviewer overlap)  
**Tests run:** 4735 (482 files) | **Pass:** 4701 | **Skip:** 34 | **Fail:** 0

---

## 1. Test Status

**ALL TESTS PASS.** No failing tests in openclaw/video/publish/mission/gateway/smart-resume suites.
Unit coverage is thorough; mocks are correct; no hoisting warnings in target files.

TypeScript: `pnpm tsc --noEmit` — **0 errors** (build is clean).

---

## 2. Git Log — Relevant Commits (Chronological, Newest First)

| SHA | Message | Risk |
|-----|---------|------|
| `4b573ba2` | feat(missions): BYOK HeyGen render step (cycle 11) | Added `submitByokVideo` + soft-skip on `BYOK_REQUIRED` |
| `8264237f` | feat(missions): autonomous video orchestrator (cycle 10) | `runAutoVideoMission` chain wired |
| `5d8c29b2` | feat: register-publishing-channel + SDK quickstart | New channel registration path |
| `e35466ea` | fix(publish): move algorithm to /api/publish/quick-schedule | Collision fix — old route may still exist |
| `0a5564b2` | feat(publish): schedule-video-publish algorithm | `schedulePublish()` added |
| `28094a1c` | feat(telegram): OpenClaw 100/100 surface via 7 mirror commands | Bridge wired for all 7 tools |

No evidence of a regression commit. Bugs are **design gaps** not regressions.

---

## 3. Production Audit Findings — Unresolved P0/P1

From `researcher-260427-0250-track-01-e2e-pipeline-audit.md` (2026-04-27):

- `BLOCKER #1` (campaigns table): **Resolved** — migration 0018 exists.
- `BLOCKER #2` (ServiceFactory auto-mock): **Partially resolved** — BYOK path now uses `resolveUserApiKey()` + throws `BYOK_REQUIRED` when key absent. No silent mock. BUT: mock mode flag `NEXT_PUBLIC_MOCK_AI_SERVICES` still accepted at runtime (no hard removal).

From `scout-260429-2211-video-gen-audit.md` and `researcher-260508-1829-raas-video-pipeline-gap-research.md`:
- Distribution gaps (TikTok/IG/FB/X via Upload-Post NPM) — still **unimplemented** (P1, not blocking E2E for YouTube-only)
- Video provider (Wan 2.1 / Revideo) — still Remotion/HeyGen only

---

## 4. Failure Scenario Analysis

### Bug 1 — CONFIRMED: Schedule Step Silently Swallows `VIDEO_NOT_FOUND` When HeyGen Skipped
**File:** `src/land/missions/auto-video-mission.ts:235-239`

**Scenario:** User has no HeyGen BYOK key. Step 4 (render) soft-skips — `videoResult` stays `undefined`. Step 5 (schedule) falls back to `videoResult?.videoId ?? missionId`. `schedulePublish()` calls D1 `SELECT id FROM videos WHERE id = missionId` → returns null → throws `PublishConfigurationError('VIDEO_NOT_FOUND')`. The catch block **silently warns** and sets `publishResult = undefined`.

**Result:** `runAutoVideoMission` returns `status: 'succeeded'` with `publish: undefined`. Dashboard shows "mission succeeded" but no publish job was created. User expects publish to happen; it silently didn't.

**Reproduction:**
```
1. User has channelId configured but NO HeyGen BYOK key
2. Call runAutoVideoMission({ userId, topic: "fashion", channelId: "ch_xxx", scheduledAt: now+3600 })
3. Observe: result.status === 'succeeded', result.publish === undefined
4. Check D1: SELECT * FROM publishing_jobs WHERE tenant_id = userId → 0 rows
```

**Root cause:** Fallback `videoResult?.videoId ?? missionId` uses missionId (not in videos table) as videoId, guaranteeing VIDEO_NOT_FOUND, which is silently caught.

---

### Bug 2 — CONFIRMED: `publishing_jobs` Has No Idempotency Constraint → Cron Double-Fire Creates Duplicate Jobs
**File:** `migrations/0101-publishing-jobs-rename-video-job-id-to-video-id.sql`

**Schema gap:** No `UNIQUE(video_id, channel_id, scheduled_at)` or `UNIQUE(video_id, channel_id)` constraint on `publishing_jobs`.

**Scenario:** Inngest retry or two near-simultaneous `schedulePublish()` calls (e.g., Telegram `/auto` fired twice, or Inngest replay) → two rows with identical `(video_id, channel_id, scheduled_at)` inserted. Each picks up by `publishExecute` cron. CAS guard (`UPDATE WHERE status='scheduled'`) is per-row by `jobId` — it does NOT prevent two distinct rows from both proceeding. Result: video published twice to same channel.

**Reproduction:**
```
1. Call schedulePublish({ userId, videoId, channelId, scheduledAt }) twice in <100ms
2. D1: SELECT * FROM publishing_jobs WHERE video_id=? AND channel_id=? → 2 rows
3. Both reach status='live' after Inngest fires publish.scheduled twice
```

---

### Bug 3 — RISK: Telegram Bridge `resolveUserIdFromChat` Failure Silently Returns `null` → All Bridge Calls No-Op
**File:** `src/land/openclaw-telegram/openclaw-bridge.ts:74-88`

**Scenario:** If D1 binding is unavailable at request time (CF Worker cold-start race, wrangler.toml binding misconfiguration, or migration 0077 not applied on a fresh remote D1), `resolveUserIdFromChat` catches the error and returns `null`. All downstream bridge calls receive `userId = null` and either fail with auth errors or silently skip.

**The real risk:** This catch-and-null pattern means a Telegram user whose `/auto` command fails mid-mission gets NO error message — the bot just goes silent. No observability.

**Reproduction:**
```
1. Invoke any Telegram command with an unregistered chat_id
2. Bridge returns null → callRunAutoVideo({ userId: null, ... })
3. autoVideoMission: insertMissionRow with userId=null → D1 constraint may or may not fail
4. No Telegram error reply sent to user
```

---

## 5. Competing Hypotheses — Eliminated

| Hypothesis | Evidence | Verdict |
|------------|---------|---------|
| Bridge uses wrong DB client (Supabase vs D1) | `createServerClient()` is D1 wrapper (`seed/db/client.ts:56`) | ELIMINATED |
| SmartResumeEngine on wrong client | `getCheckpointSupabase()` returns `D1Client \| null` | ELIMINATED |
| TypeScript type errors in flow | `pnpm tsc --noEmit` = 0 errors | ELIMINATED |
| Old mock-mode silently degrading | BYOK path throws on missing keys | ELIMINATED (with caveat: env flag still works) |

---

## 6. Top 3 Root Causes Summary

| # | Location | Severity | Type |
|---|---------|---------|------|
| **1** | `auto-video-mission.ts:229` — fallback `missionId` as videoId for schedulePublish | P1 | Logic gap (silent failure) |
| **2** | `publishing_jobs` table — no UNIQUE constraint on (video_id, channel_id) | P1 | Schema gap (idempotency) |
| **3** | `openclaw-bridge.ts:85` — resolveUserIdFromChat returns null silently | P2 | Observability gap |

---

## 7. Recommended Fixes

**Fix 1 (Bug 1):** In `auto-video-mission.ts` step 5, skip schedule entirely when `videoResult` is undefined (no HeyGen render). Do NOT fall back to missionId.
```typescript
if (input.channelId && videoResult?.videoId) { ... }
```

**Fix 2 (Bug 2):** Add migration:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pub_jobs_video_channel
  ON publishing_jobs(video_id, channel_id)
  WHERE status IN ('scheduled', 'uploading');
```
Or use `INSERT OR IGNORE` + return existing jobId in `schedulePublish`.

**Fix 3 (Bug 3):** In bridge handlers, if `resolveUserIdFromChat` returns null, reply with explicit Telegram error message before aborting.

---

## Unresolved Questions

1. Is `NEXT_PUBLIC_MOCK_AI_SERVICES=true` set in any production environment? (Could re-enable mock pipeline silently.)
2. How often does the Inngest `publish.scheduled` event fire duplicate for the same jobId? (Need Inngest dashboard data.)
3. Is migration `0100-telegram-pairing-unique-paired-by.sql` applied on remote D1? (UNIQUE constraint migration — affects Bug 3 severity.)
