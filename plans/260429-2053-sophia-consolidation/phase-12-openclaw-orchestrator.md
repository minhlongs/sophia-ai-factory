# Phase 12 — OpenClaw Orchestrator

## Status: ✅ DONE 2026-04-30

## Goal
Wire 10 OpenClaw primitives để vận hành video-gen + affiliate pipeline.

## Primitives (from claudekit-distill research)
1. `script.draft` — Qwen drafts script
2. `script.review` — code-reviewer agent
3. `voice.synth` — Coqui TTS
4. `visual.gen` — template/cinematic router
5. `compose.render` — Remotion/MoviePy
6. `publish.queue` — multi-channel Inngest
7. `track.clicks` — affiliate cloak
8. `revenue.split` — commission ledger
9. `cost.ledger` — tenant cost rollup
10. `learn.feedback` — RAG memory update

## Deliverables
- [ ] OpenClaw config schema
- [ ] Primitive registry + dispatcher
- [ ] Inngest workflow definitions
- [ ] Telemetry: span per primitive (OpenTelemetry)

## Files
- `apps/sophia-ai-factory/lib/openclaw/`
- `apps/sophia-ai-factory/lib/openclaw/primitives/{1..10}.ts`

## Risk: Medium — orchestration complexity, retry semantics

## Effort: 5-7 days
