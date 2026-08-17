# Distribution OS — Abstract Channel Layer

> **Status**: Design doc (implementation in Phase 4-5)  
> **Goal**: Model-agnostic, provider-agnostic distribution primitives

## Problem

Current Sophia ties distribution to specific platforms (YouTube, Telegram, TikTok). This creates:
- Hardcoded API clients per platform
- Duplicate auth flows (OAuth per platform)
- No unified scheduling/posting interface
- No cross-platform performance comparison

## Design: Channel Abstraction

```
DistributionPlan (what/when/where)
  ├── ChannelConfig[] (per-platform settings)
  │   ├── platform: 'youtube' | 'tiktok' | 'x' | 'instagram' | 'telegram'
  │   ├── authType: 'oauth' | 'bot_token' | 'api_key'
  │   ├── schedule: CronExpression | null
  │   ├── format: ContentFormat
  │   └── metadata: Record<string, unknown>
  └── ContentAsset[] (what to distribute)
```

## DistributionAsset

Links a ContentAsset to a specific channel post:

```typescript
interface DistributionAsset {
  id: string;
  workspaceId: string;
  projectId: string;
  assetId: string;
  channel: string;
  platformPostId: string | null;
  status: 'scheduled' | 'posted' | 'failed' | 'removed';
  scheduledAt: number;
  postedAt: number | null;
  analytics: Record<string, number>;  // views, likes, shares
  error: string | null;
  createdAt: number;
}
```

## Adapter Pattern

Each platform gets an adapter implementing:

```typescript
interface DistributionAdapter {
  platform: string;
  authenticate(credentials: Record<string, string>): Promise<void>;
  upload(asset: ContentAsset, config: ChannelConfig): Promise<string>; // returns platformPostId
  updateAnalytics(platformPostId: string): Promise<Record<string, number>>;
  delete(platformPostId: string): Promise<void>;
}
```

Adapters live in `src/forest/distribution/adapters/` (one file per platform).

## Why This Design

- **Provider-agnostic**: Adding a new platform = new adapter, no core changes
- **Model-agnostic**: Distribution doesn't care which AI model generated the content
- **Unified scheduling**: Single cron queue for all platforms
- **Cross-platform analytics**: Normalized metrics regardless of source API

## Migration Path

1. Phase 4: Define types + D1 schema (this doc)
2. Phase 5: Build YouTube adapter (existing OAuth flow)
3. Phase 6: Build Telegram adapter (existing bot flow)
4. Phase 7: Abstract current posting logic into adapters
5. Phase 8: Add cross-platform analytics aggregation

## Database Tables

```sql
CREATE TABLE distribution_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  name TEXT NOT NULL,
  channels TEXT NOT NULL, -- JSON array of ChannelConfig
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE distribution_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  platform_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at INTEGER NOT NULL,
  posted_at INTEGER,
  analytics TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at INTEGER NOT NULL
);
```

## See Also

- `src/seed/types/creative-domain.ts` — DistributionPlan, ChannelConfig, ContentAsset types
- `src/tree/content-graph/types.ts` — ContentAsset CRUD
- `AGENT_PROTOCOL.md` — How agents trigger distribution