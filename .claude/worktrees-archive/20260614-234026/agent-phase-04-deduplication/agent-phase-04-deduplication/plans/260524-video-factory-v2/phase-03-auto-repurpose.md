# Phase 03: Auto-Repurpose Long→Shorts

**Priority:** P0 | **Status:** COMPLETED | **Est:** 5-7 days
**Depends on:** Phase 02 (batch infrastructure reused for clip queue)

## Overview

User uploads or selects a long video → AI identifies best moments → system generates 5-10 short vertical clips with captions. Competitive with Opus Clip.

## Requirements

### Functional
- Input: existing video from gallery OR upload new long video (1-30 min)
- Transcript extraction via AssemblyAI (already integrated)
- LLM highlight scoring: identify 5-10 best segments with timestamps
- Scene detection: FFmpeg `scdet` filter for visual cut points
- Merge transcript highlights + scene boundaries → final clip list
- Per-clip: re-encode 9:16 vertical, center-crop, auto-caption
- Preview clip list before generation (edit timestamps, remove clips)
- Brand kit applied to each clip (if configured)

### Non-functional
- CPU-only processing (no GPU — CF Workers constraint)
- Processing time: ~3-5s per minute of source video for scene detection
- Clip generation: parallel via Inngest (reuse batch infra)
- Max source video: 30 min (R2 upload limit considerations)

## Architecture

### Highlight Scoring (LLM)
```
Input: AssemblyAI transcript with timestamps
Prompt: "Identify the 5-10 most engaging/viral segments (15-60s each).
  Score each 1-10 on: hook strength, emotional impact, standalone clarity.
  Return JSON: [{start_ms, end_ms, score, title, reasoning}]"
Engine: OpenRouter BYOK (user's key) → Claude/GPT/Llama
```

### Scene Detection (FFmpeg)
```bash
ffmpeg -i input.mp4 -vf "select='gt(scene,0.3)',showinfo" -vsync vfr /dev/null 2>&1 | grep showinfo
```
Merge with LLM timestamps: snap clip boundaries to nearest scene cut.

### Vertical Conversion
```bash
# Center-crop 16:9 → 9:16
ffmpeg -i clip.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920" -c:a copy vertical.mp4
```

### Pipeline
```
upload/select video → extract transcript (AssemblyAI)
                    → scene detection (FFmpeg scdet)
                    → LLM highlight scoring
                    → merge boundaries → clip manifest
                    → user preview/edit
                    → fan-out clip generation (Inngest)
                    → apply brand kit + captions per clip
                    → deliver to gallery
```

## D1 Schema
```sql
CREATE TABLE repurpose_jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  source_video_id TEXT NOT NULL,
  status TEXT DEFAULT 'analyzing', -- analyzing|clips_ready|generating|completed|failed
  clip_manifest TEXT, -- JSON array of clips with timestamps
  total_clips INTEGER DEFAULT 0,
  completed_clips INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE repurpose_clips (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  job_id TEXT NOT NULL,
  clip_index INTEGER NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  score REAL,
  title TEXT,
  status TEXT DEFAULT 'pending', -- pending|generating|done|failed
  output_video_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES repurpose_jobs(id)
);
```

## Files to Create/Modify

### Create
- `src/seed/db/migrations/NNNN_repurpose_jobs.sql`
- `src/seed/db/repositories/repurpose-jobs-repo.ts`
- `src/lib/video/highlight-scorer.ts` (LLM transcript analysis)
- `src/lib/video/scene-detector.ts` (FFmpeg scdet wrapper)
- `src/lib/video/clip-boundary-merger.ts` (merge highlights + scenes)
- `src/lib/video/vertical-cropper.ts` (16:9 → 9:16 FFmpeg filter)
- `src/app/actions/repurpose-action.ts`
- `src/app/[locale]/dashboard/videos/repurpose/page.tsx`
- `src/app/[locale]/dashboard/videos/repurpose/components/clip-preview-editor.tsx`
- `src/forest/inngest/functions/repurpose-analyze.ts`
- `src/forest/inngest/functions/repurpose-clip-generate.ts`

### Modify
- `src/lib/video/composer-ffmpeg.ts` — vertical crop mode
- `src/lib/video/subtitle-generator.ts` — vertical caption positioning

## Implementation Steps

- [x] 1. D1 migration: repurpose_jobs + repurpose_clips
- [x] 2. scene-detector.ts: FFmpeg scdet wrapper → timestamp array
- [x] 3. highlight-scorer.ts: LLM prompt for transcript scoring → clip manifest
- [x] 4. clip-boundary-merger.ts: snap LLM timestamps to scene cuts
- [x] 5. vertical-cropper.ts: center-crop FFmpeg filter
- [x] 6. repurpose-analyze Inngest function: transcript → scene detect → score → manifest
- [x] 7. Clip preview editor UI: timeline, adjust boundaries, remove clips
- [x] 8. repurpose-clip-generate Inngest function: extract + crop + caption per clip
- [x] 9. repurpose-action.ts: orchestrate the full flow
- [x] 10. Integrate brand kit (watermark + colors on clips)
- [x] 11. Tests: scoring, boundary merging, FFmpeg commands

## Success Criteria

- Upload 5-min video → get 5-8 suggested clips within 2 min
- User can preview/edit clip boundaries before generation
- Generated clips are vertical 9:16 with captions
- Brand kit applied to all clips
