# Phase 06 — Video Pipeline Foundation

## Status: PENDING (blocked by Phase 5 ✅, ready to start)

## Goal
Wire D1 schema + FSM + Inngest queue + R2 storage cho video lifecycle.

## Key Insights (from SYNTHESIS.md)
- 5-layer pipeline: Script (Qwen) → Audio (Coqui) → T2V (HunyuanVideo) → Compose (Remotion/MoviePy) → Publish
- Cost target: $5.50-16.55/cinematic, $0.35-1.00/template

## Deliverables
- [ ] D1 migration: `videos`, `video_jobs`, `video_assets`, `video_publish_log`
- [ ] FSM states: `draft → generating → composing → reviewing → published → failed`
- [ ] Inngest functions: `video.create`, `video.compose`, `video.publish`
- [ ] R2 buckets: `sophia-video-raw`, `sophia-video-final`, `sophia-video-thumb`
- [ ] Cost ledger entry per state transition

## Files to create
- `apps/sophia-ai-factory/migrations/0XX_video_pipeline.sql`
- `apps/sophia-ai-factory/lib/video/fsm.ts`
- `apps/sophia-ai-factory/lib/video/inngest-functions.ts`
- `apps/sophia-ai-factory/lib/video/r2-storage.ts`

## Success Criteria
- D1 schema applied (local + remote)
- FSM transitions covered by unit tests
- Inngest event flow E2E test passes
- R2 upload/download round-trip works

## Risk: Medium — Inngest + D1 + R2 coordination, retry semantics

## Effort: 3-5 days
