---
title: "Social RNN Publishing Module — Option C"
description: "Automated multi-channel social publishing with RNN-scheduled content delivery. Publish to Telegram, Facebook, TikTok, YouTube from Sophia dashboard."
status: approved
verdict: GO
priority: P2
effort: "34h"
branch: "main"
tags: [business-development, social-rnn, option-c, tdd]
blockedBy: []
blocks: []
created: "2026-07-11T09:31:03.282Z"
createdBy: "ck:plan"
source: skill
---

# Social RNN Publishing Module — TDD Implementation Plan

## Data Flow

```
Video Generation (Inngest)
  → forest/inngest/functions/video-publish.ts
  → schedulePublish() (forest/publishing/schedule-publish.ts)
    → DB: publishing_jobs row inserted
    → Event: publish.scheduled emitted
      → publishExecute() (forest/inngest/functions/publish-execute.ts)
        → channel adapter.upload()  // existing
        → DB: publishing_results row inserted (includes metrics_json stub)
          → (Phase 3) engagementCollector Inngest cron (hourly)
            → adapter.getMetrics() for each recent result
            → update publishing_results.metrics_json
            → DB: rnn_schedule updated with engagement signal
              → (Phase 2) scheduler.getOptimalPublishTime() reads rnn_schedule
                → next publish uses learned optimal times

User (dashboard)
  → Server Actions (land/social/)
    → channel connection, calendar, history, metrics views
      → DB queries on publishing_channels, publishing_jobs, publishing_results
```

## Dependencies

- Phase order: 1 → 2 → 3 → 4 → 5 → 6 (strict — each adds to prior)
- Migration numbering: WhiteLabel uses 0218-0221 → Social RNN uses 0222-0224 (sequential, no collision)
- WhiteLabel runs parallel — no shared files.
- Existing assets to REUSE (YAGNI/DRY):
  - `forest/publishing/youtube-adapter.ts`, `tiktok-adapter.ts` — adapters need `getMetrics()` added
  - `land/video/publishing/providers/facebook-publisher.ts` — has `getMetrics()` at line 84 already
  - `seed/types/channel-provider.ts:7` — `Publisher` interface declares `getMetrics(externalPostId): Promise<MetricsJson>`
  - `forest/publishing/publisher-interface.ts` — `PublishingChannel`, `PublishingJob`, `PublishingResult` D1 types
  - `forest/publishing/scheduler.ts` — `schedulePublish()` already has `optimizeSchedule` flag
  - `forest/publishing/schedule-publish.ts` — inserts publishing_jobs + emits Inngest event
  - `forest/inngest/functions/publish-execute.ts` — dispatch handler
  - `forest/publishing/per-channel-quota.ts` — token bucket rate limiter
  - `tree/telegram/telegram-bot.ts` — existing @Sophia_Bbot (reuse bot token)
  - `forest/inngest/client.ts` — Inngest app instance for cron registration

## Cross-Plan Notes

- WhiteLabel runs in parallel — no shared files or migration numbers.

## Phases

| Phase | Name | File | Status | Priority |
|-------|------|------|--------|----------|
| 1 | [External Approvals / Adapter Metrics](./phase-01-external-approvals.md) | phase-01-external-approvals.md | Pending | P2 |
| 2 | [Publishing Layer + RNN Scheduler](./phase-02-publishing-layer.md) | phase-02-publishing-layer.md | Pending | P2 |
| 3 | [Engagement Collector](./phase-03-engagement-layer.md) | phase-03-engagement-layer.md | Pending | P2 |
| 4 | [Channel UI](./phase-04-channel-ui.md) | phase-04-channel-ui.md | Pending | P2 |
| 5 | [Module Billing Gate](./phase-05-module-billing.md) | phase-05-module-billing.md | Pending | P2 |
| 6 | [Tests & Integration](./phase-06-tests.md) | phase-06-tests.md | Pending | P2 |

---

## Phase 1: External Approvals / Adapter Metrics

### Context (verified from codebase)

Checklist: Telegram, Facebook, TikTok, YouTube, Instagram. Existing codebase state:

- `forest/publishing/youtube-adapter.ts:1` — exports `youtubeAdapter`, has `uploadVideo()` and `pollStatus()` but **NO `getMetrics()`** (only in test stubs: `__tests__/youtube-publisher.test.ts:36` shows it returns zeros for mock — method not yet implemented)
- `forest/publishing/tiktok-adapter.ts:1` — exports `tiktokAdapter`, has `uploadVideo()` but **NO `getMetrics()`** (see `__tests__/tiktok-publisher.test.ts` structure)
- `land/video/publishing/providers/facebook-publisher.ts:84` — **ALREADY HAS `getMetrics()`** implemented (Graph API insights endpoint). Facebook is complete.
- `forest/publishing/instagram-adapter.ts` — check if has `getMetrics()` (see `__tests__/instagram-publisher.test.ts:34` shows zeros for mock)
- `seed/types/channel-provider.ts:7` — `Publisher` interface: `upload`, `pollStatus`, `getMetrics` — all three required
- Telegram: NO publisher class yet; only bot instance in `tree/telegram/telegram-bot.ts` for inbound messages

**What this phase builds:**
1. Add `getMetrics()` to `youtube-adapter.ts` (YouTube Data API v3 videos.list?part=statistics)
2. Add `getMetrics()` to `tiktok-adapter.ts` (TikTok Post API v2 video query)
3. Create `tree/publishing/providers/telegram-publisher.ts` — new `TelegramPublisher` class implementing `Publisher` interface (uses existing bot token)
4. Verify Instagram adapter (check test stub at `__tests__/instagram-publisher.test.ts` — if stub returns zeros, implement real)

### Requirements

- **Functional:** Each `Publisher` implementation returns `{views, likes, comments, shares, reach}` per platform API
- **Functional:** `getMetrics(externalPostId)` uses existing `access_token` stored on `PublishingChannel` D1 row
- **Non-functional:** Graceful degradation — 404/expired-token → return zero counts, never throw unhandled
- **Non-functional:** 30s timeout per fetch (platform APIs vary; YouTube slower)
- **Security:** Access tokens from D1 `publishing_channels.access_token` — encrypted via existing `token-crypto.ts`
- **i18n:** Error messages from metrics fetch → bilingual VN+EN

### Architecture

```
tree/publishing/youtube-adapter.ts  (EXTEND getMetrics)
  → GET /youtube/v3/videos?part=statistics&id={id}
  → parse: viewCount, likeCount, commentCount (no shareCount in API)

tree/publishing/tiktok-adapter.ts   (EXTEND getMetrics)
  → GET /v2/video/query/?fields=video_id,like_count,comment_count,share_count,view_count
  → auth: Bearer {access_token}

tree/publishing/providers/telegram-publisher.ts  (NEW — TelegramPublisher class)
  → implements Publisher: upload(by sendVideo → messageId), pollStatus, getMetrics
  → getMetrics: getChat or getMessageViews to count views (Telegram has no likes/shares)
  → upload: sendVideo to chat_id

tree/publishing/providers/instagram-adapter.ts   (VERIFY — stub may need real impl)
  → check existing implementation; Instagram Basic Display API vs Graph API
```

Data flow per adapter: `externalPostId` → platform REST API → `MetricsJson` (normalized).

### Files to Create/Modify

| File | Layer | Action |
|------|-------|--------|
| `src/tree/publishing/youtube-adapter.ts` | tree | MODIFY — add `getMetrics()` method |
| `src/tree/publishing/tiktok-adapter.ts` | tree | MODIFY — add `getMetrics()` method |
| `src/tree/publishing/providers/telegram-publisher.ts` | tree | CREATE |
| `src/tree/publishing/providers/instagram-adapter.ts` | tree | MODIFY — verify or implement `getMetrics()` |
| `src/forest/publishing/__tests__/youtube-metrics.test.ts` | forest (test) | CREATE |
| `src/forest/publishing/__tests__/tiktok-metrics.test.ts` | forest (test) | CREATE |
| `src/tree/publishing/providers/__tests__/telegram-metrics.test.ts` | tree (test) | CREATE |

### TDD Steps

#### S1-1: YouTube adapter getMetrics

**Test first** (`forest/publishing/__tests__/youtube-metrics.test.ts`):
```typescript
describe('YoutubeAdapter.getMetrics', () => {
  it('returns metrics from successful videos.list response', async () => {
    mockFetch(200, { items: [{ statistics: { viewCount: '1000', likeCount: '50', commentCount: '10' } }] });
    const m = await youtubeAdapter.getMetrics('video_abc123');
    expect(m).toEqual({ views: 1000, likes: 50, comments: 10, shares: undefined });
  });

  it('returns zero metrics on 404 (video not found)', async () => {
    mockFetch(404, {});
    const m = await youtubeAdapter.getMetrics('ghost_video');
    expect(m).toEqual({ views: 0, likes: 0, comments: 0 });
  });

  it('returns zero metrics on 401 (expired token) — graceful, not throw', async () => {
    mockFetch(401, { error: { code: 401 } });
    const m = await youtubeAdapter.getMetrics('video_abc');
    expect(m).toEqual({ views: 0, likes: 0, comments: 0 });
  });

  it('returns shares: undefined (YouTube has no share count)', async () => {
    mockFetch(200, { items: [{ statistics: { viewCount: '5', likeCount: '1' } }] });
    const m = await youtubeAdapter.getMetrics('v1');
    expect(m.shares).toBeUndefined();
  });
});
```

**Implement** (`src/tree/publishing/youtube-adapter.ts`):
- Add `async getMetrics(externalPostId: string): Promise<MetricsJson>` to `youtubeAdapter` object
- Use `YT_VIDEOS_URL + '?part=statistics&id=' + externalPostId`
- Header: `Authorization: Bearer ${accessToken}` (token from env/config — no new credential path)
- Parse `statistics.viewCount`, `statistics.likeCount`, `statistics.commentCount` as integers
- YouTube has NO share count in stats API → return undefined for `shares`
- 404/401 → return zeros, log warning via `logger`
- Use `MetricsJson` type from `seed/types/channel-provider.ts`

**Verify:** Run `youtube-metrics.test.ts` → 4/4 pass. Run existing `youtube-publisher.test.ts` → no regression.

#### S1-2: TikTok adapter getMetrics

**Test first** (`forest/publishing/__tests__/tiktok-metrics.test.ts`):
```typescript
describe('TikTokAdapter.getMetrics', () => {
  it('returns metrics from TikTok Post API v2', async () => {
    mockFetch(200, {
      data: { videos: [{ id: 'v1', like_count: 25, comment_count: 5, share_count: 3, view_count: 500 }] },
    });
    const m = await tiktokAdapter.getMetrics('v1');
    expect(m).toEqual({ views: 500, likes: 25, comments: 5, shares: 3 });
  });

  it('returns zeros when video not found', async () => {
    mockFetch(200, { data: { videos: [] } });
    const m = await tiktokAdapter.getMetrics('missing');
    expect(m).toEqual({ views: 0, likes: 0, comments: 0, shares: 0 });
  });

  it('returns zeros on 401 expired token', async () => {
    mockFetch(401, {});
    const m = await tiktokAdapter.getMetrics('v1');
    expect(m).toEqual({ views: 0, likes: 0, comments: 0, shares: 0 });
  });
});
```

**Implement** (`src/tree/publishing/tiktok-adapter.ts`):
- Add `async getMetrics(externalPostId: string): Promise<MetricsJson>`
- TikTok Post API v2 endpoint: `GET https://open.tiktokapis.com/v2/video/query/`
- Fields: `video_id,view_count,like_count,comment_count,share_count`
- Auth: reuse OAuth from `tiktok/tiktok-token-manager.ts` (both are tree layer — same layer import allowed)
- 401/403 → zeros + logger.warn
- Empty result array → zeros

**Verify:** `tiktok-metrics.test.ts` 3/3 pass. Existing `tiktok-publisher.test.ts` unchanged.

#### S1-3: Telegram publisher (NEW — implements Publisher for Telegram)

Telegram is currently inbound-only (Sophia_Bbot). Publishing to Telegram requires a NEW class that sends video + collects view counts.

**Test first** (`tree/publishing/providers/__tests__/telegram-petrics.test.ts`):
```typescript
describe('TelegramPublisher', () => {
  let publisher: TelegramPublisher;
  const botToken = 'test_token';

  beforeEach(() => { publisher = new TelegramPublisher(botToken); });

  it('upload() sends sendVideo → returns messageId as externalPostId', async () => {
    mockFetch(200, { result: { message_id: 42, chat: { id: -100 } } });
    const id = await publisher.upload('https://r2.dev/v.mp4', { caption: 'hi', hashtags: ['test'] });
    expect(id).toBe('42');
  });

  it('getMetrics() for Telegram returns views from message', async () => {
    mockFetch(200, { result: { message_id: 42, views: 230 } });
    const m = await publisher.getMetrics('42');
    expect(m.views).toBe(230);
  });

  it('getMetrics() returns zero comments/shares (Telegram has no such counters)', async () => {
    mockFetch(200, { result: { message_id: 1, views: 5 } });
    const m = await publisher.getMetrics('1');
    expect(m.comments).toBe(0);
    expect(m.shares).toBe(0);
  });

  it('upload() throws on 400 (bot not in group)', async () => {
    mockFetch(400, { description: 'bot is not a member' });
    await expect(publisher.upload('url', { caption: '', hashtags: [] })).rejects.toThrow('bot is not a member');
  });
});
```

**Implement** (`src/tree/publishing/providers/telegram-publisher.ts`):
```typescript
import type { Publisher, PublishMeta, MetricsJson } from '../publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export class TelegramPublisher implements Publisher {
  constructor(private readonly botToken: string) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    const chatId = extractChatId(meta); // from PublishMeta or stored context
    const res = await fetch(`${TELEGRAM_API}${this.botToken}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        video: videoUrl,
        caption: meta.caption + hashtagsToString(meta.hashtags),
      }),
    });
    // handle response → return messageId as string
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    // Telegram sendVideo is synchronous → always 'live' if no error
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    const res = await fetch(`${TELEGRAM_API}${this.botToken}/getMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: parseInt(externalPostId) }),
    });
    const data = await res.json();
    return { views: data.result?.views ?? 0, likes: 0, comments: 0, shares: 0 };
  }
}
```

**Verify:** `telegram-metrics.test.ts` 4/4 pass.

#### S1-4: Verify Instagram adapter (read-only check)

Inspect `forest/publishing/instagram-adapter.ts` and its test. If `getMetrics()` returns zeros in test stub, implement real Facebook Graph API call (Instagram Graph API endpoint for media insights).

**Verify:** `instagram-publisher.test.ts` shows real metrics, not mock zeros.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| YouTube Data API quota exhausted | Low | Medium | Each getMetrics call = 1 unit; 10,000/day budget = ~10k fetches/day |
| TikTok sandbox limits | Medium | Low | Graceful zero return on 403; TikTok developer access is manual |
| Telegram bot not in target chat | Medium | High | Validate channel membership at connect time (Phase 4 gate). Fail at connection, not at publish. |
| Instagram Graph API requires Business Account | Medium | Medium | Facebook Business Manager setup is prerequisite—document in Setup Wizard |

### Rollback

- Revert individual adapter diffs (`git checkout forest/publishing/youtube-adapter.ts`)
- Delete `tree/publishing/providers/telegram-publisher.ts`
- No DB schema changes in this phase — zero migration risk

### Success Criteria

- [ ] `youtubeAdapter.getMetrics()` returns real stats from mocked API
- [ ] `tiktokAdapter.getMetrics()` returns real stats
- [ ] `TelegramPublisher` class implements full `Publisher` interface (upload + poll + metrics)
- [ ] Facebook `getMetrics()` verified working (already implemented)
- [ ] Instagram `getMetrics()` verified or documented as blocked
- [ ] All new tests pass; existing publisher tests unchanged (no regressions)
- [ ] Zero `:any` types in new code

---

## Phase 2: Publishing Layer + RNN Scheduler (0218-rnn-schedule)

### Context

`forest/publishing/scheduler.ts:48` has `getAbsoluteTimestamp()` and `schedulePublish()` which already inserts `publishing_jobs` and emits `publish.scheduled`. The `SchedulePublishInput` interface (line 20) includes `optimizeSchedule?: boolean`. UNUSED until now. Also: `publishing_results` already exists with `metrics_json` column (per migration 0091). What doesn't exist:

- `rnn_schedule` D1 table — per-tenant per-channel optimal publish time (hour, day, confidence)
- `forest/social/rnn-scheduler.ts` — reads/writes `rnn_schedule`, computes optimal window

### Requirements

- **Functional:** `RnnScheduler.getOptimalPublishTime(tenantId, channelId, provider)` → returns `{hour, dayOfWeek, confidence}` or null
- **Functional:** Algorithm: weighted average of engagement per (hour, day) from `publishing_results.metrics_json`
- **Functional:** `RnnScheduler.recordPublish(tenantId, channelId, provider, metricsJson)` → upserts `rnn_schedule`
- **Functional:** Fallback: if less than 3 data points → return null (caller uses default time)
- **Functional:** Integrate into `scheduler.ts`: when `optimizeSchedule=true`, call `RnnScheduler` and adjust `scheduledAt` to optimal window
- **Non-functional:** RNN update is async — new publish post doesn't wait for metrics to compute (decoupled)
- **Security:** `rnn_schedule` rows scoped to `tenant_id` — zero cross-tenant visibility
- **i18n:** Log messages bilingual VN+EN

### Architecture

```
D1: rnn_schedule table
  id TEXT PK, tenant_id TEXT, channel_id TEXT, provider TEXT,
  optimal_hour INTEGER, optimal_day_of_week INTEGER,
  confidence REAL, post_count INTEGER,
  engagement_avg REAL, updated_at TEXT,
  UNIQUE(tenant_id, channel_id, provider)

forest/social/rnn-scheduler.ts
  class RnnScheduler {
    constructor(private db: D1Database) {}
    getOptimalPublishTime(tenantId, channelId, provider): {hour, day, confidence} | null
    recordPublish(tenantId, channelId, provider, metricsJson): void
    private upsertScheduleRow(...): void
    private aggregateEngagement(publishing_results rows): {hourEngagement, dayEngagement}
    private computeOptimal(...): {hour, day}
  }

forest/publishing/scheduler.ts MODIFY:
  In schedulePublish(), after initial scheduledAt is set:
    if (input.optimizeSchedule) {
      const rnn = new RnnScheduler(db);
      const optimal = rnn.getOptimalPublishTime(input.tenantId, input.channelId, input.provider);
      if (optimal) scheduledAt = shiftToOptimalWindow(scheduledAt, optimal);
      // if null → keep input scheduledAt (fallback)
    }
```

### Files to Create/Modify

| File | Layer | Action |
|------|-------|--------|
| `migrations/0218-rnn-schedule.sql` | — | CREATE |
| `src/forest/social/rnn-scheduler.ts` | forest | CREATE |
| `src/forest/social/__tests__/rnn-scheduler.test.ts` | forest | CREATE |
| `src/forest/social/__tests__/rnn-scheduler-d1.test.ts` | forest | CREATE |
| `src/forest/publishing/scheduler.ts` | forest | MODIFY — add RNN optimization branch |
| `src/forest/publishing/__tests__/scheduler.test.ts` | forest | EXTEND — add tests for optimizeSchedule=true |

### TDD Steps

#### S2-1: Migration 0218 — RNN table

**No test needed** (migration 0218 creates `rnn_schedule` table; tested via D1 integration tests in S2-3).

**File:** `migrations/0218-rnn-schedule.sql`
```sql
CREATE TABLE IF NOT EXISTS rnn_schedule (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  optimal_hour INTEGER NOT NULL DEFAULT 9 CHECK(optimal_hour >= 0 AND optimal_hour <= 23),
  optimal_day_of_week INTEGER NOT NULL DEFAULT 2 CHECK(optimal_day_of_week >= 0 AND optimal_day_of_week <= 6),
  confidence REAL NOT NULL DEFAULT 0.0 CHECK(confidence >= 0.0 AND confidence <= 1.0),
  engagement_avg REAL NOT NULL DEFAULT 0.0,
  post_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, channel_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_rnn_schedule_tenant ON rnn_schedule(tenant_id);
```

**Verify:** Run `bash scripts/apply-migrations.sh` → migration 0218 applied.

#### S2-2: RnnScheduler class (unit tests, mock D1)

**Test first** (`forest/social/__tests__/rnn-scheduler.test.ts`):
```typescript
import { RnnScheduler } from '../rnn-scheduler';

describe('RnnScheduler', () => {
  let mockDb: MockD1Database;
  let scheduler: RnnScheduler;

  it('getOptimalPublishTime returns null when no history', async () => {
    mockDb.query.mockResolvedValue({ results: [] });
    const r = scheduler.getOptimalPublishTime('tenant-1', 'ch-1', 'telegram');
    expect(r).toBeNull();
  });

  it('getOptimalPublishTime computes hour with highest engagement with >=3 posts', async () => {
    // Mock 5 publishing_results rows: 3 posted at 9am, 2 at 2pm
    // 9am: sum engagement = 120+50 views/likes, 2pm: 30+10
    const rows = [
      { metrics_json: JSON.stringify({views: 100, likes: 20}), created_at: '...' },
      { metrics_json: JSON.stringify({views: 110, likes: 30}), created_at: '...' },
      { metrics_json: JSON.stringify({views: 120, likes: 25}), created_at: '...' },
      { metrics_json: JSON.stringify({views: 20, likes: 5}), created_at: '...' },
      { metrics_json: JSON.stringify({views: 30, likes: 10}), created_at: '...' },
    ];
    mockDb.query.mockResolvedValue({ results: rows });
    const r = scheduler.getOptimalPublishTime('t1', 'ch1', 'youtube');
    expect(r).not.toBeNull();
    expect(r!.hour).toBe(9); // 9am has highest avg engagement
    expect(r!.confidence).toBeGreaterThan(0);
  });

  it('returns null when post_count < 3 (insufficient data)', async () => {
    const row = { post_count: 2, engagement_avg: 100 };
    mockDb.query.mockResolvedValue({ results: [row] });
    const r = scheduler.getOptimalPublishTime('t1', 'ch1', 'tiktok');
    expect(r).toBeNull();
  });

  it('recordPublish upserts rnn_schedule row', async () => {
    mockDb.query.mockResolvedValue({ meta: { changes: 1 } });
    scheduler.recordPublish('t1', 'ch1', 'facebook', { views: 500, likes: 80, comments: 10, shares: 5 });
    // Verify INSERT OR REPLACE was called with correct fields
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO rnn_schedule'),
      expect.any(Array)
    );
  });

  it('isolation: tenant A query never hits tenant B data', async () => {
    mockDb.query.mockImplementation((sql: string, ...params: unknown[]) => {
      // Verify first param in WHERE is always tenant_id = ? with correct value
      expect(sql).toContain('tenant_id = ?');
      expect(params[0]).toBe('tenant-A'); // not tenant-B
      return Promise.resolve({ results: [] });
    });
    scheduler.getOptimalPublishTime('tenant-A', 'ch1', 'telegram');
  });
});
```

**Implement** (`forest/social/rnn-scheduler.ts`):
```typescript
import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';

export interface OptimalTimeResult {
  hour: number; // 0-23
  dayOfWeek: number; // 0=Sunday..6=Saturday
  confidence: number; // 0.0-1.0
}

const MIN_POSTS_FOR_RECOMMENDATION = 3;
const DEFAULT_HOUR = 9;
const DEFAULT_DAY = 2; // Tuesday (business hours best default)

export class RnnScheduler {
  constructor(private db: D1Database) {}

  getOptimalPublishTime(tenantId: string, channelId: string, provider: string): OptimalTimeResult | null {
    const row = this.db.prepare(
      'SELECT optimal_hour, optimal_day_of_week, confidence, post_count FROM rnn_schedule WHERE tenant_id = ?1 AND channel_id = ?2 AND provider = ?3'
    ).bind(tenantId, channelId, provider).first();

    if (!row || row.post_count < MIN_POSTS_FOR_RECOMMENDATION) return null;
    return { hour: row.optimal_hour, dayOfWeek: row.optimal_day_of_week, confidence: row.confidence };
  }

  recordPublish(tenantId: string, channelId: string, provider: string, metrics: {views: number; likes: number; comments: number; shares: number}): void {
    const engagementScore = (metrics.views ?? 0) + (metrics.likes ?? 0) * 2 + (metrics.comments ?? 0) * 3 + (metrics.shares ?? 0) * 5;

    // Upsert: increment post_count, re-blend engagement_avg, THEN recompute optimal_hour/day
    this.db.prepare(`
      INSERT INTO rnn_schedule (tenant_id, channel_id, provider, post_count, engagement_avg, updated_at)
      VALUES (?1, ?2, ?3, 1, ?4, datetime('now'))
      ON CONFLICT(tenant_id, channel_id, provider) DO UPDATE SET
        post_count = post_count + 1,
        engagement_avg = ((rnn_schedule.engagement_avg * (rnn_schedule.post_count - 1)) + ?4) / rnn_schedule.post_count,
        updated_at = datetime('now')
    `).bind(tenantId, channelId, provider, engagementScore).run();

    // Recompute optimal from fresh results (see computeOptimalFromResults)
    this.recomputeOptimal(tenantId, channelId, provider);
  }

  private recomputeOptimal(tenantId: string, channelId: string, provider: string): void { /*  */ }
}
```

**Verify:** `rnn-scheduler.test.ts` → 5/5 pass (unit, mock D1).

#### S2-3: RnnScheduler D1 integration test

**Test** (`forest/social/__tests__/rnn-scheduler-d1.test.ts`):
```typescript
describe('RnnScheduler D1 integration', () => {
  let db: D1Database; // real D1 from test helper

  it('end-to-end: rnn_schedule row persists and survives increments', async () => {
    const s = new RnnScheduler(db);
    s.recordPublish('test-user', 'ch-yt', 'youtube', { views: 100, likes: 20, comments: 5, shares: 2 });
    const row = db.prepare('SELECT * FROM rnn_schedule WHERE tenant_id = ?').bind('test-user').first();
    expect(row.post_count).toBe(1);
    expect(row.engagement_avg).toBeCloseTo(100 + 40 + 15 + 10); // engagementScore
  });

  it('UNIQUE constraint allows only one row per (tenant, channel, provider)', async () => {
    const s = new RnnScheduler(db);
    s.recordPublish('t1', 'ch1', 'yt', { views: 100, likes: 20, comments: 0, shares: 0 });
    s.recordPublish('t1', 'ch1', 'yt', { views: 200, likes: 40, comments: 0, shares: 0 });
    const rows = db.prepare('SELECT * FROM rnn_schedule WHERE tenant_id = ?').bind('t1').all();
    expect(rows.results.length).toBe(1);
    expect(rows.results[0].post_count).toBe(2);
  });
});
```

**Verify:** D1 integration test passes using test database fixture.

#### S2-4: Modify scheduler.ts to use RNN

**Test first** (extend `forest/publishing/__tests__/scheduler.test.ts`):
```typescript
describe('scheduler.ts — RNN integration', () => {
  it('schedulePublish with optimizeSchedule=true shifts to optimal hour', async () => {
    // Setup: mock RnnScheduler to return { hour: 14, dayOfWeek: 3, confidence: 0.8 }
    const result = await scheduler.schedulePublish({ ..., optimizeSchedule: true });
    expect(result.jobs[0].scheduledAt).toBeShiftedNearHour14();
  });

  it('schedulePublish with optimizeSchedule=false ignores RNN', async () => {
    const result = await scheduler.schedulePublish({ ..., optimizeSchedule: false });
    expect(result.jobs[0].scheduledAt).toBe(originalScheduledAt);
  });

  it('schedulePublish when RNN returns null uses input scheduledAt', async () => {
    // Mock: no history → getOptimalPublishTime returns null
    const result = await scheduler.schedulePublish({ ..., optimizeSchedule: true });
    expect(result.jobs[0].scheduledAt).toBe(originalScheduledAt);
  });

  it('schedulePublish when RNN throws logs error and keeps input scheduledAt', async () => {
    // Mock: RnnScheduler constructor throws DB error
    const result = await scheduler.schedulePublish({ ..., optimizeSchedule: true });
    expect(result.jobs[0].scheduledAt).toBe(originalScheduledAt);
  });
});
```

**Implement** (`src/forest/publishing/scheduler.ts` — modify schedulePublish function):
```typescript
// After computing initial scheduledAt, before inserting publishing_jobs:
if (input.optimizeSchedule) {
  try {
    const rnn = new RnnScheduler(createServerClient().db);
    const optimal = rnn.getOptimalPublishTime(input.tenantId, channelId, provider as string);
    if (optimal) {
      scheduledAt = shiftToNextOccurrence(scheduledAt, optimal.hour, optimal.dayOfWeek, timezone);
      logger.info(`[scheduler] RNN adjusted ${provider} publish to ${formatTime(scheduledAt)} (confidence: ${optimal.confidence})`);
    }
  } catch (err) {
    logger.warn(`[scheduler] RNN optimization failed, using original schedule: ${err}`);
    // proceed with original scheduledAt
  }
}
```

**Verify:** Run `scheduler.test.ts` — old + new tests pass.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Timezone mismatch: RNN stores local hour, scheduler computes in UTC | High | High | `schedulePublishInput` has `audienceTimezone` field (line 29) — use it for all hour/day conversions |
| RNN algorithm produces absurdly early/late publish times | Low | Medium | Clamp `optimal_hour` to business hours 6-22 if outside range |
| D1 UNIQUE violation on concurrent upsert | Low | Low | `INSERT … ON CONFLICT DO UPDATE` handles this atomically |
| Confidence never exceeds 0.3 (poor signal) | Medium | Low | Don't expose confidence to user; only use internally to decide whether to trust RNN vs fallback |

### Rollback

- Remove RNN import + branch from `scheduler.ts` (revert to pre-edit)
- Drop `rnn_schedule` table: `DROP TABLE IF EXISTS rnn_schedule;` via migration rollback script

### Success Criteria

- [ ] `rnn_schedule` table created, indexes present
- [ ] `RnnScheduler.getOptimalPublishTime()` returns correct hour for mock engagement data
- [ ] `RnnScheduler.recordPublish()` updates engagement_avg, increments post_count
- [ ] `scheduler.schedulePublish(optimizeSchedule=true)` shifts `scheduledAt` to optimal hour
- [ ] `scheduler.schedulePublish(optimizeSchedule=false)` — no change to existing behavior
- [ ] Scheduler unit tests: old + new = all pass (no regression)
- [ ] Zero cross-tenant data in RNN queries (UNIQUE constraint + WHERE tenant_id verified)

---

## Phase 3: Engagement Collector (0219)

### Context

`publishing_results` table has `metrics_json` column (migration 0091). Adapters (Phase 1) now have `getMetrics()`. `forest/inngest/functions/video-publish.ts` runs post-generation. `publish-execute.ts` handles dispatch.

What does NOT exist: the cron job that sweeps recent `publishing_results` rows with stale/null `metrics_json`, calls `adapter.getMetrics()` for each, and stores results back. This phase builds the Inngest cron + metrics collector.

### Requirements

- **Functional:** Hourly Inngest cron (id: `engagement/poll`, cron: `0 * * * *`) scans `publishing_results` from last 24h where `metrics_json IS NULL` or `metrics_fetched_at > 1h ago`
- **Functional:** For each matched row, find channel adapter, call `getMetrics(externalPostId)`, write back to `metrics_json`, update `metrics_fetched_at`
- **Functional:** Concurrent `rnn_schedule` update via `RnnScheduler.recordPublish()` after each metrics write
- **Functional:** Dead-letter: if getMetrics fails 3+ times for same post, mark `metrics_fetch_attempts=3`, skip next cycles
- **Functional:** Max 50 posts per cron run (prevent cold-start backlog blowup)
- **Non-functional:** Per-channel token bucket (reuse `forest/publishing/per-channel-quota.ts` pattern) — Telegram 1/s, Facebook 200/hr, YouTube 10k units/day
- **Non-functional:** Cron failure = log + skip (no retry storm — Inngest retry handles failures)

### Architecture

```
Inngest cron: engagement/poll (hourly at :00)
  |
  v
engagementCollector()
  1. Query D1: SELECT * FROM publishing_results
     WHERE metrics_json IS NULL OR metrics_fetched_at < NOW - 1h
     AND metrics_fetch_attempts < 3
     ORDER BY published_at DESC
     LIMIT 50
  |
  v
  For each row (parallel within rate limits):
    a) Check per-provider rate limit (acquireToken or skip if exhausted)
    b) Find adapter for channel.provider → call getMetrics(externalPostId)
    c) Normalize via MetricsNormalizer
    d) UPDATE publishing_results SET metrics_json=?, metrics_fetched_at=NOW()
    e) INSERT INTO engagement_metrics (...)  -- time-series snapshot
    f) RnnScheduler(db).recordPublish(tenantId, channelId, provider, normalizedMetrics)
    g) On error: UPDATE metrics_fetch_attempts += 1
  |
  v
  Return: { processed: N, skipped: M, errors: K }
```

### Files to Create/Modify

| File | Layer | Action |
|------|-------|--------|
| `migrations/0219-engagement-metrics.sql` | — | CREATE |
| `src/forest/social/engagement-collector.ts` | forest | CREATE |
| `src/tree/social/metrics-normalizer.ts` | tree | CREATE |
| `src/forest/social/__tests__/engagement-collector.test.ts` | forest | CREATE |
| `src/forest/social/__tests__/engagement-collector-d1.test.ts` | forest | CREATE |
| `src/tree/social/__tests__/metrics-normalizer.test.ts` | tree | CREATE |
| `src/forest/inngest/functions/engagement-collector.ts` | forest | CREATE (Inngest cron fn) |

### TDD Steps

#### S3-1: Migration 0219 — engagement_metrics

**No test for pure SQL.**

**File:** `migrations/0219-engagement-metrics.sql`
```sql
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  publishing_result_id TEXT NOT NULL,
  publishing_job_id TEXT,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  reach INTEGER,
  engagement_score REAL NOT NULL DEFAULT 0.0,
  recorded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (publishing_result_id) REFERENCES publishing_results(id)
);
CREATE INDEX IF NOT EXISTS idx_eng_metrics_tenant_date ON engagement_metrics(tenant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_eng_metrics_provider ON engagement_metrics(provider, recorded_at DESC);
```

**Verify:** Apply via `bash scripts/apply-migrations.sh`.

#### S3-2: MetricsNormalizer (tree layer)

**Test first** (`tree/social/__tests__/metrics-normalizer.test.ts`):
```typescript
import { normalizeMetrics } from '../metrics-normalizer';

describe('MetricsNormalizer', () => {
  it('normalizes YouTube stats → canonical schema', () => {
    const raw = { views: '1500', likes: '80', commentCount: '20' }; // YouTube strings
    expect(normalizeMetrics('youtube', raw)).toEqual({
      views: 1500, likes: 80, comments: 20, shares: 0, reach: undefined,
    });
  });

  it('normalizes TikTok → shares populated', () => {
    const raw = { views: 5000, like_count: 300, comment_count: 60, share_count: 40 };
    expect(normalizeMetrics('tiktok', raw)).toEqual({
      views: 5000, likes: 300, comments: 60, shares: 40,
    });
  });

  it('normalizes Telegram → comments/shares always 0', () => {
    const raw = { views: 200 };
    expect(normalizeMetrics('telegram', raw)).toEqual({
      views: 200, likes: 0, comments: 0, shares: 0,
    });
  });

  it('handles null/undefined values as 0', () => {
    const raw = { views: null, likes: undefined };
    expect(normalizeMetrics('youtube', raw)).toEqual({
      views: 0, likes: 0, comments: 0, shares: 0,
    });
  });

  it('strips non-canonical keys', () => {
    const raw = { views: 100, platformSpecific: 'junk', nsfw: false };
    const result = normalizeMetrics('youtube', raw);
    expect(result).not.toHaveProperty('platformSpecific');
    expect(result).not.toHaveProperty('nsfw');
  });
});
```

**Implement** (`src/tree/social/metrics-normalizer.ts`):
```typescript
export interface CanonicalMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach?: number;
}

const DEFAULTS = { views: 0, likes: 0, comments: 0, shares: 0 };

export function normalizeMetrics(provider: string, raw: Record<string, unknown>): CanonicalMetrics {
  const toNum = (v: unknown): number => (typeof v === 'number') ? v : parseInt(String(v ?? 0), 10) || 0;
  const base = { ...DEFAULTS };

  switch (provider) {
    case 'youtube':
      return { ...base, views: toNum(raw.viewCount ?? raw.views), likes: toNum(raw.likeCount ?? raw.likes), comments: toNum(raw.commentCount ?? raw.comments) };
    case 'tiktok':
      return { ...base, views: toNum(raw.view_count ?? raw.views), likes: toNum(raw.like_count ?? raw.likes), comments: toNum(raw.comment_count ?? raw.comments), shares: toNum(raw.share_count ?? raw.shares) };
    case 'telegram':
      return { ...base, views: toNum(raw.views) }; // Telegram has no likes/comments/shares counter
    case 'facebook':
      return { ...base, views: toNum(raw.video_views ?? raw.views), likes: toNum(raw.total_likes ?? raw.likes), comments: toNum(raw.total_comments) };
    default:
      return base;
  }
}
```

**Verify:** 5/5 tests pass.

#### S3-3: EngagementCollector (unit tests, mock D1 + adapters)

**Test first** (`forest/social/__tests__/engagement-collector.test.ts`):
```typescript
describe('engagementCollector', () => {
  it('processes stale publishing_results and writes metrics_json', async () => {
    // Mock D1: 3 stale rows (metrics_json null)
    mockDb.query.mockResolvedValueOnce({ results: [{ id: 'r1', provider: 'youtube', external_post_id: 'v1', tenant_id: 't1', channel_id: 'c1' }, ...] });
    const mockAdapter = { getMetrics: jest.fn().mockResolvedValue({ views: 100, likes: 20, comments: 5, shares: 0 }) };
    const result = await engagementCollector(mockDb, mockAdapterFactory);
    expect(result.processed).toBe(3);
    // Verify D1 UPDATE called with metrics_json set
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE publishing_results SET metrics_json'));
  });

  it('skips rows with metrics_fetch_attempts >= 3', async () => {
    mockDb.query.mockResolvedValueOnce({ results: [{ ...attempts: 3 }] });
    const result = await engagementCollector(mockDb, adapterFactory);
    expect(result.skipped).toBe(1);
  });

  it('skips non-stale rows', async () => {
    const oneHourAgo = Date.now() - 30 * 60 * 1000; // 30 min ago
    mockDb.query.mockResolvedValueOnce({ results: [{ metrics_fetched_at: formatISODate(oneHourAgo) }] });
    const result = await engagementCollector(mockDb, adapterFactory);
    expect(result.skipped).toBe(1);
  });

  it('limits to MAX_FETCH_PER_RUN rows', async () => {
    const manyRows = Array.from({ length: 60 }, (_, i) => ({ id: `r${i}` })); // more than MAX=50
    mockDb.query.mockResolvedValueOnce({ results: manyRows });
    const result = await engagementCollector(mockDb, adapterFactory);
    expect(result.processed).toBeLessThanOrEqual(50);
  });

  it('increments fetch_attempts on adapter failure', async () => {
    mockDb.query.mockResolvedValueOnce({ results: [{ id: 'r1', provider: 'youtube', channel_post_id: 'vX', tenant_id: 't1', channel_id: 'c1', metrics_fetch_attempts: 1 }] });
    const failingAdapter = { getMetrics: jest.fn().mockRejectedValue(new Error('API timeout')) };
    const result = await engagementCollector(mockDb, () => failingAdapter);
    expect(result.errors).toBe(1);
    // Verify UPDATE to metrics_fetch_attempts = 2
    const updateCalls = mockDb.prepare.mock.calls.filter(([sql]) => sql.toString().includes('UPDATE publishing_results'));
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  it('rate-limits per channel — skips when token bucket empty', async () => {
    // Mock rate limiter: returns false (no token available)
    mockRateLimiter.acquire.mockReturnValue(false);
    const result = await engagementCollector(mockDb, adapterFactory);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('writes to engagement_metrics on success', async () => {
    mockDb.query.mockResolvedValueOnce({ results: [staleRow] });
    mockAdapter.getMetrics.mockResolvedValue({ views: 500, likes: 50, comments: 10, shares: 5 });
    const result = await engagementCollector(mockDb, () => mockAdapter);
    // Verify INSERT INTO engagement_metrics called with canonical values
    const insertCalls = mockDb.prepare.mock.calls.filter(([sql]) => sql.toString().includes('INSERT INTO engagement_metrics'));
    expect(insertCalls.length).toBe(1);
  });
});
```

**Implement** (`src/forest/social/engagement-collector.ts`):
```typescript
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { normalizeMetrics } from '@/tree/social/metrics-normalizer';
import { RnnScheduler } from './rnn-scheduler';
import { acquireQuota } from '@/forest/publishing/per-channel-quota'; // reuse existing

const MAX_FETCH_PER_RUN = 50;
const MAX_ATTEMPTS = 3;
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export interface CollectorResult {
  processed: number;
  skipped: number;
  errors: number;
}

export async function engagementCollector(): Promise<CollectorResult> {
  const db = createServerClient().db;
  const rnn = new RnnScheduler(db);
  const result: CollectorResult = { processed: 0, skipped: 0, errors: 0 };

  // 1. Fetch stale rows
  const staleRes = db.prepare(`
    SELECT pr.id, pr.channel_post_id, pr.tenant_id, pr.channel_id, pc.provider,
           pr.metrics_json, pr.metrics_fetch_attempts, pr.metrics_fetched_at,
           julianday('now') - julianday(pr.metrics_fetched_at) as age_days
    FROM publishing_results pr
    JOIN publishing_channels pc ON pc.id = pr.channel_id
    WHERE (pr.metrics_json IS NULL OR pr.metrics_fetched_at IS NULL
           OR pr.metrics_fetched_at < datetime('now', '-1 hour'))
      AND (pr.metrics_fetch_attempts IS NULL OR pr.metrics_fetch_attempts < ?)
    ORDER BY pr.published_at DESC
    LIMIT ?
  `).bind(MAX_ATTEMPTS, MAX_FETCH_PER_RUN).all();

  const rows = staleRes.results;
  if (rows.length === 0) return result;

  // 2. Process each row
  const adapterCache = new Map<string, ReturnType<typeof getAdapter>>();
  for (const row of rows) {
    const cacheKey = `${row.provider}-${row.tenant_id}`;
    const adapter = adapterCache.get(cacheKey) ?? await getAdapter(row.provider, row.tenant_id, row.channel_id);
    if (!adapter) { result.skipped++; continue; }

    // Rate limit
    const allowed = acquireQuota(row.provider, row.channel_id);
    if (!allowed) { result.skipped++; continue; }

    try {
      const rawMetrics = await adapter.getMetrics(row.channel_post_id);
      const canonical = normalizeMetrics(row.provider, rawMetrics);
      const metricsJson = JSON.stringify(canonical);

      // Write back
      db.prepare(`UPDATE publishing_results SET metrics_json = ?1, metrics_fetched_at = datetime('now') WHERE id = ?2`).bind(metricsJson, row.id).run();

      // Write to engagement_metrics
      db.prepare(`INSERT INTO engagement_metrics (publishing_result_id, publishing_job_id, tenant_id, channel_id, provider, views, likes, comments, shares, engagement_score) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`).bind(row.id, row.publishing_job_id, row.tenant_id, row.channel_id, row.provider, canonical.views, canonical.likes, canonical.comments, canonical.shares, computeScore(canonical)).run();

      // Update RNN
      rnn.recordPublish(row.tenant_id, row.channel_id, row.provider, canonical);

      result.processed++;
    } catch (err) {
      logger.warn(`[engagement-collector] metrics fetch failed for ${row.id}: ${err}`);
      db.prepare(`UPDATE publishing_results SET metrics_fetch_attempts = COALESCE(metrics_fetch_attempts, 0) + 1 WHERE id = ?`).bind(row.id).run();
      result.errors++;
    }
  }

  logger.info(`[engagement-collector] run complete: processed=${result.processed} skipped=${result.skipped} errors=${result.errors}`);
  return result;
}

function computeScore(m: {views: number; likes: number; comments: number; shares: number}): number {
  return (m.views ?? 0) + (m.likes ?? 0) * 2 + (m.comments ?? 0) * 3 + (m.shares ?? 0) * 5;
}
```

**Verify:** `engagement-collector.test.ts` → 7/7 pass (unit).

#### S3-4: Engagement collector D1 integration test

**Test** (`forest/social/__tests__/engagement-collector-d1.test.ts`):
```typescript
describe('engagement-collector D1 integration', () => {
  it('end-to-end: inserts row → runs collector → updates metrics_json', async () => {
    const db = await setupTestD1();
    // Insert a test publishing_results + channel
    db.prepare(`INSERT INTO publishing_results (id, publishing_job_id, tenant_id, channel_post_id, published_at) VALUES ('test-1', 'job-1', 'user-1', 'yt-video-1', datetime('now'))`).run();
    db.prepare(`INSERT INTO publishing_channels (id, tenant_id, provider) VALUES ('ch-1', 'user-1', 'youtube')`).run();

    await engagementCollector();

    const updated = db.prepare('SELECT metrics_json FROM publishing_results WHERE id = ?').bind('test-1').first();
    expect(updated.metrics_json).not.toBeNull();
    const parsed = JSON.parse(updated.metrics_json);
    expect(parsed.views).toBeGreaterThanOrEqual(0);
    // Check engagement_metrics inserted
    const eng = db.prepare('SELECT * FROM engagement_metrics WHERE publishing_result_id = ?').bind('test-1').all();
    expect(eng.results.length).toBe(1);
  });

  it('dead-letter: rows with 3 failures skipped', async () => {
    const db = await setupTestD1();
    db.prepare(`INSERT INTO publishing_results (...) VALUES (...) WITH metrics_fetch_attempts = 3`).run();
    const result = await engagementCollector();
    expect(result.skipped).toBe(1);
  });
});
```

**Verify:** integration test passes against test D1.

#### S3-5: Inngest cron registration

**Implement** (`forest/inngest/functions/engagement-collector.ts`):
```typescript
let app: Inngest;
app = new Inngest({ id: 'sophia-engagement' });

export const engagementFn = app.createFunction(
  { id: 'engagement/poll', cron: '0 * * * *' }, // hourly at :00
  { event: 'engagement/poll' },
  async () => {
    const r = await engagementCollector();
    return r; // logged by Inngest
  }
);
```

**Verify:** Register cron, check dev Inngest UI shows `engagement/poll` at `0 * * * *`.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Rate limit on Facebook/TikTok if many accounts connected | Medium | Medium | Per-channel token bucket; explorer only fetches 50/run |
| Cron backlog: 1000+ rows with null metrics → first run takes minutes | Low | Low | LIMIT 50 per run; cron runs hourly — clears in 20+ runs across a day |
| metrics_fetched_at stored as TEXT — timezone risk | Medium | Medium | Use `datetime('now')` (UTC) consistently; D1 has no timezone |

### Rollback

- Remove Inngest cron `engagementFn` from `inngest/client.ts` or `engagement-collector.ts`
- Drop `engagement_metrics` table: `DROP TABLE IF EXISTS engagement_metrics;`
- Revert `publishing_results` ALTERs: not needed (columns are additive; NULL-default)

### Success Criteria

- [ ] `engagement_metrics` table exists with correct schema
- [ ] `engagementCollector()` processes stale rows from D1 in < 30s (test)
- [ ] `normalizeMetrics()` produces consistent schema across all 4 channels
- [ ] Failed fetches trigger dead-letter skip after 3 attempts
- [ ] Rate limiter prevents token bucket exhaustion
- [ ] Inngest cron `engagement/poll` registered hourly
- [ ] All unit + D1 integration tests pass
- [ ] Zero cross-tenant data leakage in queries

---

## Phase 4: Channel UI (0220)

### Context

Dashboard has `/[locale]/dashboard/` with existing routes (billing, videos, schedule, integrations, etc.). This phase adds `/dashboard/social/*` pages. Strategic decision (from open Qs): reuse OAuth from `forest/publishing/oauth-token-refresher.ts` for channel connection.

### Requirements

- **Functional:** `/dashboard/social/channels` — list connected channels, "Connect" per supported provider
- **Functional:** `/dashboard/social/calendar` — 30-day calendar with publish schedule (reuse publish_jobs)
- **Functional:** `/dashboard/social/history` — paginated publishing_results table with platform URLs + metrics
- **Functional:** `/dashboard/social/metrics` — engagement trend charts (views/likes over 30 days via engagement_metrics)
- **Non-functional:** All Server Actions use `getCurrentUser()` with `createServerClient()` (sync)
- **Security:** RBAC check on every action: `publishing_channels.tenant_id = current_user.id`
- **i18n:** VN + EN under `messages/*.json` → `social.*` namespace

### Architecture

```
app/[locale]/dashboard/social/
  channels/
    page.tsx          → list + connect/disconnect
    actions.ts        → Server Actions (use server)
  calendar/
    page.tsx          → 30-day calendar grid (publish_jobs)
    actions.ts        → getCalendarData()
  history/
    page.tsx          → paginated publishing_results with metrics
    actions.ts        → getHistory(page, pageSize), disconnect
  metrics/
    page.tsx          → line charts (views, likes per day)
    actions.ts        → getMetricsTrend(days)

land/social/
  channels/
    actions.ts        → connect, disconnect, getChannels
  calendar/
    actions.ts        → getCalendarData
  history/
    actions.ts        → getHistory
  metrics/
    actions.ts        → getMetricsTrend

land/social/social-queries.ts  → shared D1 query helpers
```

### Files to Create/Modify

| File | Layer | Action |
|------|-------|--------|
| `src/land/social/social-queries.ts` | land | CREATE |
| `src/land/social/channels/actions.ts` | land | CREATE |
| `src/land/social/channels/page.tsx` | land | CREATE |
| `src/land/social/calendar/actions.ts` | land | CREATE |
| `src/land/social/calendar/page.tsx` | land | CREATE |
| `src/land/social/history/actions.ts` | land | CREATE |
| `src/land/social/history/page.tsx` | land | CREATE |
| `src/land/social/metrics/actions.ts` | land | CREATE |
| `src/land/social/metrics/page.tsx` | land | CREATE |
| `messages/vi.json` | — | MODIFY — add `social.*` keys |
| `messages/en.json` | — | MODIFY — add `social.*` keys |
| `src/land/social/__tests__/social-queries.test.ts` | land | CREATE |

### TDD Steps

#### S4-1: i18n keys (no test — validate with `npm run i18n:validate`)

**File:** `messages/vi.json` + `messages/en.json`
Add `social` namespace:
```json
{
  "social": {
    "channels": { "title": "Kênh / Channels", "connect": "Kết nối", "disconnect": "Ngắt kết nối", "connected": "Đã kết nối", "connect_youtube": "Kết nối YouTube", "connect_tiktok": "Kết nối TikTok", "connect_facebook": "Kết nối Facebook", "connect_telegram": "Kết nối Telegram", "gated_title": "Nâng cấp để dùng", "gated_desc": "Gói Premium trở lên mới dùng được kênh mạng xã hội" },
    "calendar": { "title": "Lịch đăng / Calendar", "no_posts": "Chưa có bài đăng lịch" },
    "history": { "title": "Lịch sử đăng / Publishing History", "published_at": "Thời gian đăng", "platform_url": "Liên kết", "views": "Lượt xem", "likes": "Lượt thích", "no_posts": "Chưa có bài đăng" },
    "metrics": { "title": "Số liệu / Metrics", "views": "Lượt xem", "likes": "Lượt thích", "comments": "Bình luận", "shares": "Chia sẻ", "last_30_days": "30 ngày qua" }
  }
}
```

**Verify:** `npm run i18n:validate` → 0 missing keys.

#### S4-2: Social queries

**Test first** (`land/social/__tests__/social-queries.test.ts`):
```typescript
import { getChannels, getHistory, getCalendarData, getMetricsTrend } from '../social-queries';

describe('social-queries', () => {
  const mockDb = createMockD1();

  it('getChannels returns user channels sorted by created_at', () => {
    mockDb.seed('publishing_channels', [
      { id: 'c1', tenant_id: 'u1', provider: 'youtube', display_name: 'YT', status: 'active' },
      { id: 'c2', tenant_id: 'u1', provider: 'tiktok', display_name: 'TT', status: 'active' },
    ]);
    const channels = getChannels(mockDb, 'u1');
    expect(channels).toHaveLength(2);
    expect(channels[0].provider).toBe('youtube');
  });

  it('getChannels isolates tenant — user2 never sees user1 channels', () => {
    mockDb.seed('publishing_channels', [
      { id: 'c1', tenant_id: 'u1', provider: 'youtube' },
      { id: 'c2', tenant_id: 'u2', provider: 'tiktok' },
    ]);
    const channels = getChannels(mockDb, 'u1');
    expect(channels.every(c => c.tenant_id === 'u1')).toBe(true);
  });

  it('getHistory returns paginated results', () => {
    // Seed 60 publishing_results rows, fetch page 1 (50) and page 2 (10)
    const page1 = getHistory(mockDb, 'u1', 1, 50);
    const page2 = getHistory(mockDb, 'u1', 2, 50);
    expect(page1.rows).toHaveLength(50);
    expect(page2.rows).toHaveLength(10);
  });

  it('getCalendarData returns 30 days with post counts', () => {
    // Seed publish_jobs for today, tomorrow
    const cal = getCalendarData(mockDb, 'u1', 30);
    expect(cal.length).toBe(30);
    expect(cal[0].posts).toBeGreaterThanOrEqual(0);
  });

  it('getMetricsTrend returns daily aggregates from engagement_metrics', () => {
    mockDb.seed('engagement_metrics', [
      { tenant_id: 'u1', provider: 'youtube', views: 1000, likes: 50, recorded_at: '2026-07-01T10:00:00' },
    ]);
    const trend = getMetricsTrend(mockDb, 'u1', 7);
    expect(trend).toContainEqual({ date: '2026-07-01', views: 1000, likes: 50, comments: 0, shares: 0 });
  });
});
```

**Implement** (`src/land/social/social-queries.ts`):
```typescript
import { createServerClient } from '@/seed/db/client';
import type { PublishingChannel, PublishingResult } from '@/forest/publishing/publisher-interface';

export function getChannels(userId: string, tenantId: string): PublishingChannel[] {
  const db = createServerClient().db;
  const rows = db.prepare(
    'SELECT id, provider, display_name, status, access_token_hash, created_at FROM publishing_channels WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC'
  ).bind(tenantId, userId).all();
  return rows.results as PublishingChannel[];
}

export function getHistory(userId: string, tenantId: string, page: number, pageSize: number): { rows: any[]; total: number } {
  const db = createServerClient().db;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT pr.*, pc.provider, pc.display_name
    FROM publishing_results pr
    JOIN publishing_channels pc ON pc.id = pr.channel_id
    WHERE pr.tenant_id = ? AND pc.user_id = ?
    ORDER BY pr.published_at DESC LIMIT ? OFFSET ?
  `).bind(tenantId, userId, pageSize, offset).all();
  // ...
}

export function getCalendarData(tenantId: string, userId: string, days: number): CalendarDay[] { /* ... */ }
export function getMetricsTrend(tenantId: string, userId: string, days: number): MetricsTimeSeries[] { /* ... */ }
```

**Verify:** Tests pass.

#### S4-3: Server Actions — channels

**Test** (in same file `social-queries.test.ts`, extend):
```typescript
import { connectChannel, disconnectChannel, getChannelsAction } from './channels/actions';

describe('channels Server Actions', () => {
  it('connectChannel inserts row and returns channel', () => { /* mock getCurrentUser + DB */ });
  it('connectChannel with BASIC tier returns gated (Phase 5)', () => { /* Phase 5 deferred — mark @skip, implement in P5 */ });
  it('disconnectChannel soft-deletes', () => { /* status='expired' */ });
  it('disconnectChannel throws NotFoundError on non-owned channel', () => { /* assert throw */ });
});
```

**Implement** (`land/social/channels/actions.ts`):
```typescript
'use server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';

export async function getChannelsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return getChannels(createServerClient().db, user.id, user.tenantId);
}

export async function disconnectChannel(channelId: string) {
  const user = await getCurrentUser();
  const db = createServerClient().db;
  const r = db.prepare('UPDATE publishing_channels SET status = ? WHERE id = ? AND user_id = ?').bind('disconnected', channelId, user.id).run();
  if (r.changes === 0) throw new Error('Channel not found or not owned by user');
}
```

**Verify:** Test with mocked `getCurrentUser` → assert actions.

#### S4-4: Channel page UI

No automated unit test needed (presentation layer). Manual smoke test in Phase 6.

**Implement** (`land/social/channels/page.tsx`):
```typescript
import { getChannelsAction } from './actions';
import { useTranslations } from 'next-intl';

export default async function ChannelsPage({ params: { locale } }) {
  const channels = await getChannelsAction();
  const t = useTranslations('social');
  return (
    <DashboardShell>
      <h1>{t('channels.title')}</h1>
      {channels.map(ch => <ChannelCard key={ch.id} channel={ch} />)}
      <ConnectButtons /> {/* YouTube, TikTok, Facebook, Telegram */}
    </DashboardShell>
  );
}
```

#### S4-5: Calendar, History, Metrics pages

Follow same pattern: Server Actions (tested) + page component (manual QA). All in `land/social/{calendar,history,metrics}/`.

**Calendar:** `getCalendarData` returns `{date, count, topProvider}` per day. Render 30-day grid. Click → shows top 3 posts for that day via expandable row.

**History:** Paginated table: date | provider | caption | url | views | likes. Use `getHistory` from social-queries. 50 rows per page.

**Metrics:** Two SVG line charts (Views, Likes) via `getMetricsTrend(30)`. No external charting library (KISS). Render `<svg>` manually.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large publish history causes slow page loads | Low | High | Pagination (50 rows), LIMIT in all queries |
| OAuth callback flow broken by locale prefix | Low | Medium | Social OAuth callbacks land at `/auth/callback` (no locale in path) |
| Chat layout break from new social routes | Low | Low | Social routes live under `/dashboard/social/` — isolated |

### Rollback

- Delete `src/land/social/` directory entirely
- Remove `social` i18n namespace from messages

### Success Criteria

- [ ] All 4 social pages render without TypeScript errors (`npm run build`)
- [ ] Server actions unit tests: `getChannels`, `disconnect`, `getHistory`, `getCalendarData`, `getMetricsTrend` → 6+ tests pass
- [ ] i18n validation: 0 missing keys
- [ ] Pagination works (page 2, page 1 isolated)
- [ ] Auth gate: unauthenticated user blocked (Server Action checks `getCurrentUser`)

---

## Phase 5: Module Billing Gate (0220-billing-social)

### Context

Sophia has `BASIC | PREMIUM | ENTERPRISE | MASTER` tiers. `land/billing/` handles NOWPayments IPN. `seed/db/get-user-tier.ts` returns current tier. NOT present: feature gating per feature category (social as a gated add-on).

### Requirements

- **Functional:** `connectChannel()` server action checks tier before allowing channel registration
- **Functional:** BASIC tier → returns `{gated: true, upgradeUrl}` with upgrade prompt
- **Functional:** PREMIUM → 5 channels max; ENTERPRISE → 12; MASTER → unlimited
- **Functional:** Channel count check: if user already at tier max, return gated
- **Non-functional:** Gate is in-process check in Server Action (no DB schema change beyond existing audit)

### Architecture

```
connectChannel(tenantId, provider, channelName)
  → getCurrentUser() → userId
  → getUserTier(userId) → tier
  → TIER_SOCIAL_LIMITS[tier]: { enabled: boolean, maxChannels: number }
  → if !enabled: return { gated: true, upgradeUrl: '/dashboard/billing' }
  → count = SELECT count(*) FROM publishing_channels WHERE tenant_id = ? AND status = 'active'
  → if count >= maxChannels: return { gated: false, blocked: true, reason: 'max_reached' }
  → ELSE: proceed with channel registration
```

### Files to Create/Modify

| File | Layer | Action |
|------|-------|--------|
| `src/seed/config/tiers/social-addon.ts` | seed | CREATE |
| `src/seed/config/tiers/__tests__/social-addon.test.ts` | seed | CREATE |
| `src/land/social/channels/actions.ts` | land | MODIFY — add billing gate |
| `src/land/social/__tests__/channels-gated.test.ts` | land | CREATE |

### TDD Steps

#### S5-1: Tier configuration

**Test first** (`seed/config/tiers/__tests__/social-addon.test.ts`):
```typescript
import { TIER_SOCIAL_LIMITS, type TierSocialLimits } from '../../social-addon';

describe('TIER_SOCIAL_LIMITS', () => {
  const tiers = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

  it.each(tiers)('%s has correct social limits', (tier) => {
    const limits: TierSocialLimits = TIER_SOCIAL_LIMITS[tier];
    expect(typeof limits.enabled).toBe('boolean');
    expect(typeof limits.maxChannels).toBe('number');
    expect(typeof limits.features).toBe('object');
  });

  it('BASIC → enabled=false, maxChannels=0', () => {
    expect(TIER_SOCIAL_LIMITS.BASIC.enabled).toBe(false);
    expect(TIER_SOCIAL_LIMITS.BASIC.maxChannels).toBe(0);
  });

  it('PREMIUM → enabled=true, maxChannels=5', () => {
    expect(TIER_SOCIAL_LIMITS.PREMIUM.enabled).toBe(true);
    expect(TIER_SOCIAL_LIMITS.PREMIUM.maxChannels).toBe(5);
  });

  it('ENTERPRISE → enabled=true, maxChannels=12', () => {
    expect(TIER_SOCIAL_LIMITS.ENTERPRISE.maxChannels).toBe(12);
  });

  it('MASTER → enabled=true, maxChannels=-1 (unlimited)', () => {
    expect(TIER_SOCIAL_LIMITS.MASTER.maxChannels).toBe(-1);
  });
});
```

**Implement** (`src/seed/config/tiers/social-addon.ts`):
```typescript
export interface TierSocialLimits {
  enabled: boolean;
  maxChannels: number;  // -1 = unlimited
  metricsRetentionDays: number;  // -1 = forever
  rnnOptimization: boolean;
}

export const TIER_SOCIAL_LIMITS: Record<string, TierSocialLimits> = {
  BASIC: { enabled: false, maxChannels: 0, metricsRetentionDays: 0, rnnOptimization: false },
  PREMIUM: { enabled: true, maxChannels: 5, metricsRetentionDays: 90, rnnOptimization: true },
  ENTERPRISE: { enabled: true, maxChannels: 12, metricsRetentionDays: 365, rnnOptimization: true },
  MASTER: { enabled: true, maxChannels: -1, metricsRetentionDays: -1, rnnOptimization: true },
};
```

**Verify:** 4/4 tests pass.

#### S5-2: Billing gate in connectChannel

Extend previous action test from Phase 4.

**Test** (`land/social/__tests__/channels-gated.test.ts`):
```typescript
import { connectChannelAction } from '../channels/actions';

describe('connectChannel tier gate', () => {
  it('BASIC user gets gated response with upgradeUrl', async () => {
    mockGetCurrentUser({ id: 'u1', tier: 'BASIC' });
    const result = await connectChannelAction('youtube', 'My Channel');
    expect(result.gated).toBe(true);
    expect(result.upgradeUrl).toContain('/dashboard/billing');
  });

  it('PREMIUM user connects successfully', async () => {
    mockGetCurrentUser({ id: 'u1', tier: 'PREMIUM' });
    mockDbEmpty();
    const result = await connectChannelAction('facebook', 'FB Page');
    expect(result.gated).toBeUndefined();
    expect(result.channelId).toBeDefined();
  });

  it('PREMIUM user with 5 existing channels gets max_reached', async () => {
    mockGetCurrentUser({ id: 'u1', tier: 'PREMIUM' });
    mockDbSeedPublishingChannels(Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, tenant_id: 'u1', status: 'active' })));
    const result = await connectChannelAction('youtube', 'YT6');
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('max_reached');
  });

  it('disconnect freed a slot — can reconnect', async () => {
    mockGetCurrentUser({ id: 'u1', tier: 'PREMIUM' });
    mockDbSeedPublishingChannels(Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, tenant_id: 'u1', status: 'active' })));
    // disconnect c0
    await disconnectChannelAction('c0');
    const result = await connectChannelAction('youtube', 'YT-New');
    expect(result.blocked).toBeUndefined();
  });
});
```

**Modify** `src/land/social/channels/actions.ts` (add gate at top of connectChannel):
```typescript
import { getUserTier } from '@/seed/db/get-user-tier';
import { TIER_SOCIAL_LIMITS } from '@/seed/config/tiers/social-addon';
import { logger } from '@/seed/utils/logger-utility';

export async function connectChannelAction(provider: string, displayName: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const tier = await getUserTier(user.id);
  const limits = TIER_SOCIAL_LIMITS[tier];

  if (!limits.enabled) {
    return { gated: true, upgradeUrl: '/dashboard/billing', reason: 'tier_not_eligible' };
  }

  const db = createServerClient().db;
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM publishing_channels WHERE tenant_id = ? AND status = ?').bind(user.tenantId, 'active').first() as { cnt: number };
  if (limits.maxChannels !== -1 && countRow.cnt >= limits.maxChannels) {
    return { blocked: true, reason: 'max_reached', current: countRow.cnt, max: limits.maxChannels };
  }

  // Proceed with channel registration...
}
```

**Verify:** `channels-gated.test.ts` → 4/4 pass.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tier check bypassed by direct API call | Low | High | All mutations use Server Actions; no open API route for channel connect |
| NOWPayments IPN tier activation lag → user upgraded but still gated | Low | Medium | NOWPayments IPN updates tier instantly in D1; `getUserTier()` reads from D1 |

### Rollback

- Revert `connectChannelAction` to pre-gate version — removes tier check entirely
- Delete `seed/config/tiers/social-addon.ts`

### Success Criteria

- [ ] BASIC tier user gets `{gated: true}` from `connectChannelAction`
- [ ] PREMIUM with 5 channels gets `{blocked: true, reason: 'max_reached'}`
- [ ] After disconnect, same user can connect again
- [ ] MASTER with 12 channels still allows 13th (unlimited)
- [ ] All 4 tests pass

---

## Phase 6: Integration, Polish, Deploy

### Context

This is the seal-and-ship phase. All components exist; we wire end-to-end, run full test suite, validate deploy.

### Requirements

- **Functional:** Full pipeline test: video produced → publish scheduled → adapter publishes → metrics collected → RNN updated → UI shows data
- **Quality:** `npm test` → all pass (new + existing)
- **Quality:** `npm run build` → 0 TypeScript errors
- **Quality:** Migration 0218 + 0219 applied
- **Deploy:** `npm run deploy:full` → SHA matches → HTTP 200

### TDD Steps

#### S6-1: End-to-end integration test

**Test** (`forest/social/__tests__/social-e2e.test.ts`):
```typescript
describe('Social RNN E2E', () => {
  it('full pipeline: publish → metrics → RNN update', async () => {
    // 1. Insert publishing_channels (telegram, youtube)
    insertChannel('t1', 'tel-1', 'telegram');
    insertChannel('t1', 'yt-1', 'youtube');

    // 2. Schedule a publish
    const jobId = schedulePublish({ videoId: 'v1', channelId: 'yt-1', optimizeSchedule: true });

    // 3. Simulate adapter publish (mock)
    mockYouTubeAdapter.upload.mockResolvedValue('yt-post-1');
    await publishExecute.dispatch({ event: 'publish.scheduled', data: { jobId } });

    // 4. Verify publishing_results row created
    const result = db.prepare('SELECT * FROM publishing_results WHERE publishing_job_id = ?').bind(jobId).first();
    expect(result.channel_post_id).toBe('yt-post-1');

    // 5. Run engagementCollector → mock getMetrics returns non-zero
    mockYouTubeAdapter.getMetrics.mockResolvedValue({ views: 500, likes: 30, comments: 5, shares: 0 });
    await engagementCollector();

    // 6. Verify publishing_results.metrics_json updated
    const updated = db.prepare('SELECT metrics_json FROM publishing_results WHERE id = ?').bind(result.id).first();
    expect(JSON.parse(updated.metrics_json).views).toBe(500);

    // 7. Verify rnn_schedule updated
    const rnn = db.prepare('SELECT * FROM rnn_schedule WHERE tenant_id = ? AND channel_id = ?').bind('t1', 'yt-1').first();
    expect(rnn.post_count).toBe(1);
    expect(rnn.engagement_avg).toBeGreaterThan(0);
  });
});
```

**Verify:** E2E test passes on test D1.

#### S6-2: Full test + build gate

```bash
cd apps/sophia-ai-factory
npm test            # all 844+ tests must pass
npm run build       # 0 TypeScript errors
npm run lint        # 0 errors in src/forest/social/ src/land/social/
npm run i18n:validate  # 0 missing keys
```

#### S6-3: Deploy verification

```bash
git push origin main
cd apps/sophia-ai-factory && npm run deploy:full
# Verify:
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] || { echo '❌ STALE'; exit 1; }
curl -sI https://sophia.agencyos.network/vi/dashboard/social/channels | head -3  # HTTP 200
```

### Success Criteria

- [ ] E2E pipeline test passes
- [ ] `npm test`: all pass (no regressions in 844+ suite)
- [ ] `npm run build`: 0 TypeScript errors
- [ ] `npm run lint`: 0 errors in new files
- [ ] `npm run i18n:validate`: 0 missing keys
- [ ] Migration 0218 + 0219 applied to D1
- [ ] `npm run deploy:full` → SHA match → HTTP 200
- [ ] Social dashboard pages load at `https://sophia.agencyos.network/vi/dashboard/social/channels`

---

## File Ownership Map (parallel safety)

| File Pattern | Owned By | Can Parallel Edit With |
|---|---|---|
| `src/tree/publishing/*-adapter.ts` | Phase 1 | No (sequential with P2) |
| `migrations/0218*.sql` | Phase 2 | No (migration order matters) |
| `migrations/0219*.sql` | Phase 3 | No |
| `src/forest/social/*` | Phase 2+3 | Yes (rnn-scheduler vs engagement-collector are separate files) |
| `src/land/social/*` | Phase 4+5 | Yes (queries separate from actions) |

No two phases write to the same file. Parallel safe within phase groups: P1 files | P2 files | P3 files | P4+P5 files.
