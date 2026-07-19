# G4 Wave 12 — Wan 2.1 + Fish Speech Video Generation

Date: 2026-05-09
Phase: Wave 12 Group G4

## Files Created

**Clients (2):**
- src/lib/video/wan21-client.ts — WanVideoClient wrapping Replicate API
- src/lib/video/fish-speech-client.ts — FishSpeechClient wrapping fal.ai

**Shared Types + Barrel (2):**
- src/lib/video/types.ts — VideoJob, AudioTrack, event payload types
- src/lib/video/index.ts — public barrel export

**Inngest Workflow (1):**
- src/forest/inngest/functions/video-generate.ts — 8-step workflow, NOT registered

**Tests (3):**
- src/lib/video/__tests__/wan21-client.test.ts — 10 tests
- src/lib/video/__tests__/fish-speech-client.test.ts — 8 tests
- src/forest/inngest/functions/video-generate.test.ts — 4 tests (+ 1 = parse, step sequence, Wan fail, R2 keys)

**Migration (1):**
- migrations/0096-video-jobs-output-columns.sql — ALTER TABLE engine_missions adds output_video_url, output_audio_url, video_job_id

## Provider Choice

**Wan 2.1:** Replicate (`wan-video/wan-2.1`) — no existing fal.ai or Replicate usage found; Replicate chosen as primary per task spec default.

**Fish Speech TTS:** fal.ai (`fal-ai/fish-speech`) — synchronous API, supports en + vi.

## Test Results

- Type check: PASS (0 new errors; 2 pre-existing errors in agent-chat/route.ts + missions/stream/route.ts not in ownership scope)
- Unit tests: 23/23 PASS (3 files)

**Wan21Client coverage:** generate 200, poll running→succeeded, poll array/string output, error 429/402/400/503
**FishSpeechClient coverage:** generate success, auth header format, voice+language params, missing URL, error 429/402/400/500
**videoGenerate workflow coverage:** happy path 8-step sequence, missing missionId, Wan job failed, R2 key convention

## Migration 0096

Needed — `engine_missions` table (migration 0052) had no video output columns. Added 3 columns via ALTER TABLE (idempotent by apply-migrations.sh sequential execution).

## DEFERRED Items

1. **FFmpeg muxing** — `mux-audio-video` step is a STUB; logs both R2 keys for next wave
2. **Inngest registration** — `videoGenerate` intentionally NOT exported in `inngest/index.ts`
3. **`video/generate.requested` event schema** — NOT added to `inngest/client.ts` Events type (out of ownership scope); used cast workaround
4. **Revideo fallback deprecation** — existing Revideo path untouched
5. **MCU pricing** — uses existing `recordCost` with flat $0.06 estimate; proper pricing table deferred

## Notes

- Inngest type bypass: shared client.ts owns event schema; used `unknown as { createFunction }` cast + typed context interface to avoid `any` leaking into function body
- R2 upload is no-op in local dev (getVideoBucket returns null gracefully)
- Poll loop uses step.sleep + step.run (Inngest durable pattern); POLL_MAX_ATTEMPTS=18 × 20s = 6 min timeout
