---
phase: 1
title: "Server Actions + API Routes"
status: pending
priority: high
---

# Phase 01 — Server Actions + API Routes

## Context

- Existing: `src/tree/clients/muapi-media-client.ts` (MuAPI client with `submitMediaJob`, `getJobStatus`, `SUPPORTED_MODELS`)
- Existing: `src/app/actions/video-generate-action.ts` (reusable for video tab)
- Existing: `src/lib/ai/elevenlabs-api-client.ts` (TTS voice + audio upload)
- Need: image generation server action + API routes for polling

## Files to Create

1. `src/app/actions/image-generate-action.ts` — Server action for image generation
2. `src/app/api/v1/creative-studio/images/route.ts` — GET: list user's generated images
3. `src/app/api/v1/creative-studio/images/generate/route.ts` — POST: trigger image gen
4. `src/app/api/v1/creative-studio/images/[id]/status/route.ts` — GET: poll job status
5. `src/app/actions/tts-generate-action.ts` — Server action for TTS audio generation

## Files to Modify

None (all new files).

## Implementation Steps

### 1. Image Generate Server Action (`image-generate-action.ts`)

```
'use server'
- Auth: getCurrentUser() -> 401
- Validate with Zod: { prompt, model, aspectRatio }
- Tier check: getUserTier() -> gate model access
  - BASIC: flux-schnell only
  - PREMIUM: flux-schnell, flux-dev, hidream
  - ENTERPRISE/MASTER: all models including midjourney-v7, flux-kontext
- Call submitMediaJob({ type: 'image', model, prompt, aspectRatio })
- Store job reference in D1: INSERT INTO media_jobs (id, user_id, type, model, status, created_at)
- Return { success: true, jobId }
```

### 2. Image List API Route (`GET /api/v1/creative-studio/images`)

```
- Auth: getCurrentUser() -> 401
- Query D1: SELECT * FROM media_jobs WHERE user_id = ? AND type = 'image' ORDER BY created_at DESC LIMIT 50
- Return JSON array of jobs with status, resultUrl, thumbnailUrl
```

### 3. Image Generate API Route (`POST /api/v1/creative-studio/images/generate`)

```
- Alternative to server action for API consumers
- Same logic as server action
- Zod validation on request body
- Return { jobId, status }
```

### 4. Image Status Poll Route (`GET /api/v1/creative-studio/images/[id]/status`)

```
- Auth: getCurrentUser() -> 401
- Read job from D1 by id + user_id (IDOR protection)
- If status is 'pending' or 'processing': call getJobStatus(id) from MuAPI client
  - Update D1 row if status changed
- Return current job status + resultUrl if completed
```

### 5. TTS Generate Server Action (`tts-generate-action.ts`)

```
'use server'
- Auth: getCurrentUser() -> 401
- Validate with Zod: { text (max 5000 chars), voiceId }
- Tier check: voice selection gating
  - BASIC: 1 default voice (Adam)
  - PREMIUM: 3 voices
  - ENTERPRISE/MASTER: all voices
- Call ElevenLabs TTS API (via existing elevenlabs-api-client.ts)
- Upload result to R2 via uploadAudioToStorage()
- Return { success: true, audioUrl }
```

### 6. D1 Migration (if needed)

Check if `media_jobs` table exists. If not:

```sql
CREATE TABLE IF NOT EXISTS media_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image', 'video', 'audio')),
  model TEXT NOT NULL,
  prompt TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result_url TEXT,
  thumbnail_url TEXT,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);
CREATE INDEX idx_media_jobs_user_type ON media_jobs(user_id, type, created_at DESC);
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `media_jobs` table collision with existing schema | Low | High | Grep for existing table name; use `creative_media_jobs` if collision |
| MuAPI key not configured (BYOK) | Medium | Medium | Check env/BYOK store, return clear error "Please configure MuAPI key in BYOK settings" |
| ElevenLabs key not configured | Medium | Medium | Same: check BYOK store before calling API |

## Todo

- [ ] Create `image-generate-action.ts` with Zod + tier gating
- [ ] Create `GET /api/v1/creative-studio/images` route
- [ ] Create `POST /api/v1/creative-studio/images/generate` route
- [ ] Create `GET /api/v1/creative-studio/images/[id]/status` route
- [ ] Create `tts-generate-action.ts` with voice gating
- [ ] Add D1 migration for `media_jobs` table (if needed)
- [ ] Verify each file < 200 lines

## Success Criteria

- [ ] `image-generate-action` accepts prompt + model + aspectRatio, returns jobId
- [ ] Image list route returns user's images (no IDOR)
- [ ] Status poll route fetches from MuAPI and updates D1
- [ ] TTS action generates audio and returns R2 URL
- [ ] All endpoints validate auth + tier
- [ ] Zero `:any` types
- [ ] `npm run build` passes
