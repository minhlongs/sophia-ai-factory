# Phase 04: Multi-Channel Publish — YouTube

**Priority:** P0 | **Status:** TODO | **Est:** 3-4 days
**Depends on:** Phase 01 (brand kit — videos need branding before publish)

## Overview

Users connect YouTube via OAuth2 → publish videos directly from Sophia. Resumable upload, status tracking, scheduled publishing.

## Requirements

### Functional
- OAuth2 connect flow (BYOK: user's own Google Cloud project client ID/secret)
- Resumable upload protocol (handles large files, network interruption)
- Video metadata: title, description, tags, category, privacy (public/unlisted/private)
- Scheduled publishing (set publish date/time)
- Upload status tracking: uploading → processing → published/failed
- Publish from video gallery (single video) or batch publish
- Credential management: store encrypted OAuth tokens, auto-refresh

### Non-functional
- YouTube Data API v3 quota: 10K units/day (upload=1600 units)
- Max ~6 uploads/day per user with default quota
- Token refresh: access_token expires 1h, use refresh_token
- BYOK: user provides Google Cloud OAuth client credentials in Setup Wizard

## Architecture

### OAuth2 Flow
```
User → Setup Wizard → enters Google Client ID/Secret
     → Sophia generates auth URL with scopes:
       youtube.upload, youtube.readonly
     → User authorizes → callback → store encrypted tokens
```

### Platform Adapter Interface
```typescript
interface PlatformAdapter {
  platform: 'youtube' | 'tiktok' | 'instagram';
  uploadVideo(params: PublishParams): Promise<PublishResult>;
  checkStatus(publishId: string): Promise<PublishStatus>;
  refreshToken(credentialId: string): Promise<void>;
}
```

### D1 Schema
```sql
CREATE TABLE platform_credentials (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at DATETIME,
  scopes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, platform)
);

CREATE TABLE video_publishes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_video_id TEXT,
  status TEXT DEFAULT 'pending', -- pending|uploading|processing|published|failed
  scheduled_at DATETIME,
  published_at DATETIME,
  error_message TEXT,
  metadata TEXT, -- JSON: title, description, tags, category, privacy
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Files to Create/Modify

### Create
- `src/seed/db/migrations/NNNN_platform_credentials.sql`
- `src/seed/db/migrations/NNNN_video_publishes.sql`
- `src/seed/db/repositories/platform-credentials-repo.ts`
- `src/seed/db/repositories/video-publishes-repo.ts`
- `src/lib/publishing/platform-adapter.ts` (interface + types)
- `src/lib/publishing/youtube-adapter.ts` (YouTube Data API v3 implementation)
- `src/lib/publishing/credential-manager.ts` (encrypt/decrypt/refresh tokens)
- `src/app/actions/publish-video-action.ts`
- `src/app/[locale]/dashboard/creative-studio/components/publish-dialog.tsx`
- `src/forest/inngest/functions/video-publish-youtube.ts`
- `src/forest/inngest/functions/publish-status-poller.ts`

### Modify
- `src/app/[locale]/dashboard/videos/components/video-detail-client.tsx` — add publish button
- `src/forest/inngest/functions/video-publish.ts` — route to platform adapter
- Creative Studio settings — add YouTube connect section

## Implementation Steps

- [ ] 1. D1 migrations: platform_credentials + video_publishes
- [ ] 2. platform-adapter.ts: PlatformAdapter interface
- [ ] 3. credential-manager.ts: encrypt/decrypt OAuth tokens (reuse AES-GCM from seed/security)
- [ ] 4. youtube-adapter.ts: resumable upload, metadata, status check
- [ ] 5. video-publish-youtube Inngest function: upload + poll status
- [ ] 6. publish-status-poller Inngest function: periodic status check until done
- [ ] 7. publish-video-action.ts: server action for publish trigger
- [ ] 8. Publish dialog UI: platform selector, metadata form, schedule picker
- [ ] 9. YouTube OAuth connect flow in Setup Wizard
- [ ] 10. Tests: adapter, credential encryption, publish flow

## Success Criteria

- User connects YouTube via OAuth in Setup Wizard
- Publish video from gallery → uploaded to YouTube with metadata
- Status tracked: uploading → processing → published
- Scheduled publish works at specified time
